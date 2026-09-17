"use server";

import { randomUUID } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento } from "@/server/_shared";
import { hashFotografiaFinanceira } from "./fotografia-financeira";
import { DecisaoPresencaHistoricaMigracaoSchema, PropostaPresencaHistoricaMigracaoSchema, ResolucaoDivergenciaPresencaHistoricaMigracaoSchema } from "./presenca-historica-schema";

const hash = hashFotografiaFinanceira;
const json = (v: unknown) => Prisma.sql`${JSON.stringify(v)}::jsonb`;
type Proposta = { id:string; status:"PENDENTE"|"APROVADA"|"REJEITADA"|"APLICADA"|"PENDENCIA_CORRECAO"; preparadorId:string; decisorId:string|null; chaveDecisao:string|null; decisaoHash:string|null; linhaId:string; mapaMatriculaId:string; matriculaId:string; aulaId:string; participacao:"PRESENTE"|"FALTA"; origem:string; presencaOrigemId:string; entradaHash:string; snapshot:Prisma.JsonValue };

async function preparadorFresco(tx: Prisma.TransactionClient, id: string) {
  const [u] = await tx.$queryRaw<{ativo:boolean;papeis:Papel[]}[]>(Prisma.sql`SELECT ativo,papeis FROM "Usuario" WHERE id=${id} FOR SHARE`);
  if (!u?.ativo || !u.papeis.some((p) => p === Papel.SECRETARIA_ACADEMICA || p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao("Exige contexto acadêmico ativo.");
}
async function decisorFresco(tx: Prisma.TransactionClient, id: string) {
  const [u] = await tx.$queryRaw<{ativo:boolean;papeis:Papel[]}[]>(Prisma.sql`SELECT ativo,papeis FROM "Usuario" WHERE id=${id} FOR SHARE`);
  if (!u?.ativo || !u.papeis.some((p) => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao("A decisão acadêmica exige Gestão Pedagógica ou Administração ativa.");
}

export async function proporPresencaHistoricaMigracao(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
    const d = PropostaPresencaHistoricaMigracaoSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      await preparadorFresco(tx, autor.id);
      const [fonte] = await tx.$queryRaw<{id:string;origem:string;entradaHash:string;dadosOrigem:Prisma.JsonValue;matriculaOrigemId:string;mapaId:string;matriculaId:string;aulaId:string;alunoId:string;ocorridaEm:Date;turmaId:string|null;nomeAluno:string}[]>(Prisma.sql`
        SELECT l.id,lo.origem,l."entradaHash",l."dadosOrigem",l."matriculaOrigemId",m.id AS "mapaId",m."matriculaId",a.id AS "aulaId",mat."alunoId",a."ocorridaEm",a."turmaId",al."primeiroNome" || COALESCE(' ' || al.sobrenome,'') AS "nomeAluno"
        FROM "LinhaPreparacaoMigracao" l JOIN "LotePreparacaoMigracao" lo ON lo.id=l."loteId"
        JOIN "MapaOrigemMatriculaMigracao" m ON m.origem=lo.origem AND m."matriculaOrigemId"=l."matriculaOrigemId"
        JOIN "Matricula" mat ON mat.id=m."matriculaId" JOIN "Aluno" al ON al.id=mat."alunoId" JOIN "AulaDiario" a ON a.id=${d.aulaId}
        WHERE l.id=${d.linhaId} AND l."tipoEntrada"='HISTORICO_PRESENCA'::"TipoEntradaPreparacaoMigracao" AND NULLIF(btrim(l."dadosOrigem"->>'presencaOrigem'),'') IS NOT NULL FOR UPDATE`);
      if (!fonte || !fonte.turmaId) throw new ErroRegra("Escolha uma aula histórica existente e uma linha M01 com presença comprovada.");
      if (fonte.ocorridaEm.getTime() > Date.now()) throw new ErroRegra("A aula histórica não pode estar no futuro.");
      const alocacoes = await tx.$queryRaw<{id:string}[]>(Prisma.sql`SELECT al.id FROM "AlocacaoTurma" al WHERE al."matriculaId"=${fonte.matriculaId} AND al."alunoId"=${fonte.alunoId} AND al."turmaId"=${fonte.turmaId} AND alocacao_cobre_instante(al, ${fonte.ocorridaEm} AT TIME ZONE 'UTC') AND situacao_matricula_no_instante(${fonte.matriculaId}, (${fonte.ocorridaEm} AT TIME ZONE 'UTC')::timestamp)='ATIVA' FOR SHARE`);
      if (alocacoes.length !== 1) throw new ErroRegra("A aula não possui vínculo histórico acadêmico único e ativo."); const alocacao=alocacoes[0]!;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`m01-presenca:${fonte.origem}:${d.presencaOrigemId}`},0))`;
      const entrada = {...d, mapaMatriculaId:fonte.mapaId, matriculaId:fonte.matriculaId}; const entradaHash=hash(entrada);
      const [replay] = await tx.$queryRaw<{id:string;entradaHash:string}[]>(Prisma.sql`SELECT id,"entradaHash" AS "entradaHash" FROM "PropostaPresencaHistoricaMigracao" WHERE "preparadorId"=${autor.id} AND "chaveIdempotencia"=${d.chaveIdempotencia} FOR SHARE`);
      if (replay) { if (replay.entradaHash!==entradaHash) throw new ErroRegra("A chave idempotente já representa outra proposta."); return {id:replay.id,repetida:true}; }
      const [aplicada] = await tx.$queryRaw<{id:string}[]>(Prisma.sql`SELECT id FROM "AplicacaoPresencaHistoricaMigracao" WHERE origem=${fonte.origem} AND "presencaOrigemId"=${d.presencaOrigemId} FOR SHARE`);
      if (aplicada) throw new ErroRegra("Esta presença de origem já foi aplicada ou encaminhada para correção.");
      const [ultima] = await tx.$queryRaw<{versao:number}[]>(Prisma.sql`SELECT versao FROM "PropostaPresencaHistoricaMigracao" WHERE origem=${fonte.origem} AND "presencaOrigemId"=${d.presencaOrigemId} ORDER BY versao DESC LIMIT 1 FOR SHARE`);
      const snapshot={linha:{id:fonte.id,origem:fonte.origem,entradaHash:fonte.entradaHash,dadosOrigem:fonte.dadosOrigem,matriculaOrigemId:fonte.matriculaOrigemId},mapa:{id:fonte.mapaId,matriculaId:fonte.matriculaId},aula:{id:fonte.aulaId,ocorridaEm:fonte.ocorridaEm.toISOString(),turmaId:fonte.turmaId},alocacao:{id:alocacao.id},aluno:{id:fonte.alunoId,nome:fonte.nomeAluno}};
      const id=randomUUID();
      await tx.$executeRaw`INSERT INTO "PropostaPresencaHistoricaMigracao" (id,origem,"presencaOrigemId",versao,"linhaId","mapaMatriculaId","matriculaId","aulaId",participacao,evidencia,entrada,snapshot,"entradaHash","estadoHash","chaveIdempotencia","preparadorId") VALUES (${id},${fonte.origem},${d.presencaOrigemId},${(ultima?.versao??0)+1},${fonte.id},${fonte.mapaId},${fonte.matriculaId},${fonte.aulaId},${d.participacao}::"ParticipacaoAula",${json(d.evidencia)},${json(entrada)},${json(snapshot)},${entradaHash},${hash(snapshot)},${d.chaveIdempotencia},${autor.id})`;
      await registrarEvento(tx,{tipo:"PropostaPresencaHistoricaMigracao",agregadoTipo:"Matricula",agregadoId:fonte.matriculaId,autorId:autor.id,payload:{propostaId:id,linhaId:fonte.id,aulaId:fonte.aulaId,origem:fonte.origem,presencaOrigemId:d.presencaOrigemId}});
      return {id,repetida:false};
    });
  });
}

export async function decidirPresencaHistoricaMigracao(input: unknown) {
  return executarAcao(async () => {
    const autor=await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO,Papel.ADMINISTRADOR); const d=DecisaoPresencaHistoricaMigracaoSchema.parse(input); const decisaoHash=hash({propostaId:d.propostaId,aprovada:d.aprovada,motivo:d.motivo});
    const resultado=await prisma.$transaction(async (tx)=>{
      await decisorFresco(tx,autor.id); const [p]=await tx.$queryRaw<Proposta[]>(Prisma.sql`SELECT * FROM "PropostaPresencaHistoricaMigracao" WHERE id=${d.propostaId} FOR UPDATE`);
      if(!p) throw new ErroRegra("Proposta não encontrada."); if(p.preparadorId===autor.id) throw new ErroPermissao("A decisão exige outra pessoa.");
      if(p.status!=="PENDENTE") { if(p.decisorId===autor.id&&p.chaveDecisao===d.chaveIdempotencia&&p.decisaoHash===decisaoHash)return{id:p.id,repetida:true}; throw new ErroRegra("A proposta já recebeu decisão diferente."); }
      if(!d.aprovada){await tx.$executeRaw`UPDATE "PropostaPresencaHistoricaMigracao" SET status='REJEITADA',"decisorId"=${autor.id},"chaveDecisao"=${d.chaveIdempotencia},"decisaoHash"=${decisaoHash},"motivoDecisao"=${d.motivo},"decididoEm"=now() WHERE id=${p.id}`;return{id:p.id,rejeitada:true};}
      const atuais=await tx.$queryRaw<{alunoId:string;nomeAluno:string}[]>(Prisma.sql`SELECT m."alunoId",al."primeiroNome" || COALESCE(' ' || al.sobrenome,'') AS "nomeAluno" FROM "LinhaPreparacaoMigracao" l JOIN "LotePreparacaoMigracao" lo ON lo.id=l."loteId" JOIN "MapaOrigemMatriculaMigracao" mm ON mm.id=${p.mapaMatriculaId} AND mm.origem=lo.origem AND mm."matriculaOrigemId"=l."matriculaOrigemId" JOIN "Matricula" m ON m.id=mm."matriculaId" JOIN "Aluno" al ON al.id=m."alunoId" JOIN "AulaDiario" a ON a.id=${p.aulaId} JOIN "AlocacaoTurma" at ON at."matriculaId"=m.id AND at."alunoId"=m."alunoId" AND at."turmaId"=a."turmaId" AND alocacao_cobre_instante(at,a."ocorridaEm" AT TIME ZONE 'UTC') AND situacao_matricula_no_instante(m.id,a."ocorridaEm")='ATIVA' WHERE l.id=${p.linhaId} AND l."tipoEntrada"='HISTORICO_PRESENCA'::"TipoEntradaPreparacaoMigracao" AND l."entradaHash"=(${json(p.snapshot)}->'linha'->>'entradaHash') AND a."ocorridaEm" AT TIME ZONE 'UTC'<=clock_timestamp() FOR SHARE`); const atual=atuais.length===1?atuais[0]:null;
      if(!atual) throw new ErroRegra("A origem, mapa, contrato, vínculo ou aula mudou; crie nova proposta.");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`m01-presenca-aplicar:${p.aulaId}:${atual.alunoId}`},0))`;
      const [existente]=await tx.$queryRaw<{id:string;participacao:"PRESENTE"|"FALTA"|null;presente:boolean|null}[]>(Prisma.sql`SELECT id,participacao,presente FROM "RegistroAulaAluno" WHERE "aulaId"=${p.aulaId} AND "alunoId"=${atual.alunoId} FOR UPDATE`);
      await tx.$executeRaw`UPDATE "PropostaPresencaHistoricaMigracao" SET status='APROVADA',"decisorId"=${autor.id},"chaveDecisao"=${d.chaveIdempotencia},"decisaoHash"=${decisaoHash},"motivoDecisao"=${d.motivo},"decididoEm"=now() WHERE id=${p.id}`;
      const igual=existente && existente.participacao===p.participacao && existente.presente===(p.participacao==="PRESENTE"); const aplicacaoId=randomUUID();
      if(existente&&!igual){await tx.$executeRaw`INSERT INTO "AplicacaoPresencaHistoricaMigracao" (id,"propostaId",origem,"presencaOrigemId",resultado,"registroExistenteId","aplicadaPorId",snapshot) VALUES (${aplicacaoId},${p.id},${p.origem},${p.presencaOrigemId},'DIVERGENCIA',${existente.id},${autor.id},${json({propostaId:p.id,registroExistenteId:existente.id,pendencia:"CORRECAO_Q23"})})`;await tx.$executeRaw`UPDATE "PropostaPresencaHistoricaMigracao" SET status='PENDENCIA_CORRECAO',"aplicadaEm"=now() WHERE id=${p.id}`;return{id:p.id,pendenciaCorrecao:true};}
      const registroId=existente?.id??randomUUID(); if(!existente)await tx.$executeRaw`INSERT INTO "RegistroAulaAluno" (id,"aulaId","alunoId","matriculaId","nomeAluno",presente,participacao) VALUES (${registroId},${p.aulaId},${atual.alunoId},${p.matriculaId},${atual.nomeAluno},${p.participacao==='PRESENTE'},${p.participacao}::"ParticipacaoAula")`;
      await tx.$executeRaw`INSERT INTO "AplicacaoPresencaHistoricaMigracao" (id,"propostaId",origem,"presencaOrigemId",resultado,"registroId","registroExistenteId","aplicadaPorId",snapshot) VALUES (${aplicacaoId},${p.id},${p.origem},${p.presencaOrigemId},${existente?'VINCULO_EXISTENTE':'NOVO_REGISTRO'}::"ResultadoAplicacaoPresencaHistoricaMigracao",${registroId},${existente?.id??null},${autor.id},${json({propostaId:p.id,registroId,resultado:existente?'VINCULO_EXISTENTE':'NOVO_REGISTRO'})})`;
      await tx.$executeRaw`UPDATE "PropostaPresencaHistoricaMigracao" SET status='APLICADA',"aplicadaEm"=now() WHERE id=${p.id}`;
      await registrarEvento(tx,{tipo:"PresencaHistoricaMigracaoAplicada",agregadoTipo:"Matricula",agregadoId:p.matriculaId,autorId:autor.id,payload:{propostaId:p.id,aulaId:p.aulaId,registroId,origem:p.origem,presencaOrigemId:p.presencaOrigemId}});return{id:p.id,registroId,repetida:false};
    }); try { revalidatePath("/configuracao/migracao"); } catch { /* integração não possui store de geração */ } return resultado;
  });
}

export async function consultarPresencasHistoricasMigracao(linhaId:string) {
  return executarAcao(async()=>{const autor=await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA,Papel.GERENTE_PEDAGOGICO,Papel.ADMINISTRADOR);return prisma.$transaction(async tx=>{await preparadorFresco(tx,autor.id);return tx.$queryRaw(Prisma.sql`SELECT p.id,p.status,p.participacao,p.evidencia,p."criadoEm",p."motivoDecisao",u.nome AS "preparadorNome",d.nome AS "decisorNome",a.resultado FROM "PropostaPresencaHistoricaMigracao" p JOIN "Usuario" u ON u.id=p."preparadorId" LEFT JOIN "Usuario" d ON d.id=p."decisorId" LEFT JOIN "AplicacaoPresencaHistoricaMigracao" a ON a."propostaId"=p.id WHERE p."linhaId"=${linhaId} ORDER BY p.versao DESC`);});});
}

export async function listarAulasElegiveisPresencaHistoricaMigracao(linhaId:string) {
  return executarAcao(async()=>{const autor=await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA,Papel.GERENTE_PEDAGOGICO,Papel.ADMINISTRADOR);return prisma.$transaction(async tx=>{await preparadorFresco(tx,autor.id);return tx.$queryRaw<{id:string;ocorridaEm:Date;conteudo:string;turma:string|null}[]>(Prisma.sql`SELECT DISTINCT a.id,a."ocorridaEm",a.conteudo,t.nome AS turma FROM "LinhaPreparacaoMigracao" l JOIN "LotePreparacaoMigracao" lo ON lo.id=l."loteId" JOIN "MapaOrigemMatriculaMigracao" mm ON mm.origem=lo.origem AND mm."matriculaOrigemId"=l."matriculaOrigemId" JOIN "Matricula" m ON m.id=mm."matriculaId" JOIN "AlocacaoTurma" al ON al."matriculaId"=m.id AND al."alunoId"=m."alunoId" JOIN "AulaDiario" a ON a."turmaId"=al."turmaId" LEFT JOIN "Turma" t ON t.id=a."turmaId" WHERE l.id=${linhaId} AND l."tipoEntrada"='HISTORICO_PRESENCA'::"TipoEntradaPreparacaoMigracao" AND alocacao_cobre_instante(al,a."ocorridaEm" AT TIME ZONE 'UTC') AND situacao_matricula_no_instante(m.id,a."ocorridaEm")='ATIVA' AND a."ocorridaEm" AT TIME ZONE 'UTC'<=clock_timestamp() ORDER BY a."ocorridaEm" DESC`);});});
}

/** Após a correção Q23, apenas vincula a comprovação ao mesmo registro existente. */
export async function resolverDivergenciaPresencaHistoricaMigracao(input:unknown) {
  return executarAcao(async()=>{const autor=await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO,Papel.ADMINISTRADOR);const d=ResolucaoDivergenciaPresencaHistoricaMigracaoSchema.parse(input);return prisma.$transaction(async tx=>{await decisorFresco(tx,autor.id);await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`m01-presenca-resolucao:${d.chaveIdempotencia}`},0))`;const [anterior]=await tx.$queryRaw<{id:string;aplicacaoId:string;resultado:"RECONCILIADA"|"MANTIDA";evidencia:Prisma.JsonValue;resolvedorId:string}[]>(Prisma.sql`SELECT id,"aplicacaoId",resultado,evidencia,"resolvedorId" FROM "ResolucaoDivergenciaPresencaHistoricaMigracao" WHERE "chaveIdempotencia"=${d.chaveIdempotencia} FOR SHARE`);if(anterior){if(anterior.aplicacaoId!==d.aplicacaoId||anterior.resultado!==d.resultado||anterior.resolvedorId!==autor.id||JSON.stringify(anterior.evidencia)!==JSON.stringify(d.evidencia))throw new ErroRegra("A chave idempotente já representa outra resolução.");return{id:anterior.id,repetida:true};}const [fonte]=await tx.$queryRaw<{registroExistenteId:string;matriculaId:string}[]>(Prisma.sql`SELECT a."registroExistenteId",p."matriculaId" FROM "AplicacaoPresencaHistoricaMigracao" a JOIN "PropostaPresencaHistoricaMigracao" p ON p.id=a."propostaId" WHERE a.id=${d.aplicacaoId} AND a.resultado='DIVERGENCIA' FOR UPDATE`);if(!fonte?.registroExistenteId)throw new ErroRegra("Divergência de presença não encontrada.");const id=randomUUID();await tx.$executeRaw`INSERT INTO "ResolucaoDivergenciaPresencaHistoricaMigracao" (id,"aplicacaoId","registroId",resultado,evidencia,"chaveIdempotencia","resolvedorId") VALUES (${id},${d.aplicacaoId},${fonte.registroExistenteId},${d.resultado}::"ResultadoResolucaoDivergenciaPresencaHistoricaMigracao",${json(d.evidencia)},${d.chaveIdempotencia},${autor.id})`;await registrarEvento(tx,{tipo:"ResolucaoDivergenciaPresencaHistoricaMigracao",agregadoTipo:"Matricula",agregadoId:fonte.matriculaId,autorId:autor.id,payload:{resolucaoId:id,aplicacaoId:d.aplicacaoId,resultado:d.resultado}});return{id,repetida:false};});});
}
