"use server";

import { Papel, Prisma, StatusMatricula } from "@prisma/client";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra } from "@/server/_shared";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { instanteAvaliacaoLocal } from "@/server/avaliacoes/tempo";

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const evidencia = z.record(z.string().min(1), z.union([z.string().min(1), z.number().finite(), z.boolean(), z.null()])).refine(v => Object.keys(v).length > 0);
const fato = z.object({ tipo: z.enum(["ATIVACAO", "PAUSA", "ENCERRAMENTO", "CANCELAMENTO"]), data: data, evidencia }).strict();
const entrada = z.object({
  linhaId: z.string().min(1), ensaioId: z.string().min(1), entradaHash: z.string().regex(/^[0-9a-f]{64}$/), contextoHash: z.string().regex(/^[0-9a-f]{64}$/),
  fusoReferencia: FusoInstitucionalSchema, semanticaFim: z.enum(["LIMITE_EXCLUSIVO", "ULTIMO_DIA_COBERTO"]),
  inicioAlocacao: data, fimAlocacao: data.nullable(), diaVencimento: z.number().int().min(1).max(31), mesesPlano: z.number().int().positive(),
  evidenciaContrato: evidencia, evidenciaPagamento: evidencia, complementoVigencia: z.object({ motivo:z.string().trim().min(10).max(1000), evidencia }).strict().optional(), fatos: z.array(fato).min(1).max(40),
}).strict();
const instanteDia = (d: string, fuso: string) => instanteAvaliacaoLocal(`${d}T00:00`, fuso);
const canonico = (v: unknown): unknown => Array.isArray(v) ? v.map(canonico) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonico(x)])) : v;
const proximoDia = (d: string) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate()+1); return x.toISOString().slice(0,10); };

export async function aplicarVinculoMigracao(input: unknown) {
 return executarAcao(async () => {
  const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR); const d = entrada.parse(input);
  return prisma.$transaction(async tx => {
   const u = await tx.usuario.findUnique({ where:{id:autor.id}, select:{ativo:true,papeis:true} });
   if (!u?.ativo || !u.papeis.includes(Papel.ADMINISTRADOR)) throw new ErroPermissao("Sua permissão mudou; atualize a página.");
   const [linha] = await tx.$queryRaw<{id:string;origem:string;entradaHash:string;alunoOrigemId:string|null;matriculaOrigemId:string|null;turmaOrigemId:string|null;dadosOrigem:unknown}[]>(Prisma.sql`SELECT l.id,l."entradaHash",l."alunoOrigemId",l."matriculaOrigemId",l."turmaOrigemId",l."dadosOrigem",lo.origem FROM "LinhaPreparacaoMigracao" l JOIN "LotePreparacaoMigracao" lo ON lo.id=l."loteId" WHERE l.id=${d.linhaId} AND l."tipoEntrada"='VINCULO_MATRICULA'::"TipoEntradaPreparacaoMigracao" FOR UPDATE`);
   if (!linha || linha.entradaHash !== d.entradaHash) throw new ErroRegra("A fotografia de vínculo mudou. Faça novo ensaio.");
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`migracao-contrato:${linha.origem}:${linha.matriculaOrigemId ?? "<ausente>"}`},0))`;
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`migracao-aplicacao-vinculo:${linha.id}`},0))`;
   const [repetida] = await tx.$queryRaw<{id:string;matriculaId:string;alocacaoId:string}[]>(Prisma.sql`SELECT id,"matriculaId","alocacaoId" FROM "AplicacaoVinculoMigracao" WHERE "linhaId"=${linha.id} AND "entradaHash"=${d.entradaHash} FOR SHARE`);
   if (repetida) return { ...repetida, repetida:true };
   const [ensaio] = await tx.$queryRaw<{id:string;resultado:string}[]>(Prisma.sql`SELECT id,resultado FROM "EnsaioVinculoMigracao" WHERE id=${d.ensaioId} AND "linhaId"=${linha.id} AND "entradaHash"=${d.entradaHash} AND "contextoHash"=${d.contextoHash} FOR SHARE`);
   if (!ensaio || ensaio.resultado !== "PRONTO_PARA_REVISAO") throw new ErroRegra("O ensaio não está pronto ou não corresponde à fotografia.");
   if (!linha.matriculaOrigemId || !linha.alunoOrigemId || !linha.turmaOrigemId) throw new ErroRegra("A identidade da matrícula, aluno ou turma está ausente.");
   const inicio = instanteDia(d.inicioAlocacao,d.fusoReferencia), fim = d.fimAlocacao ? instanteDia(d.semanticaFim === "ULTIMO_DIA_COBERTO" ? proximoDia(d.fimAlocacao) : d.fimAlocacao,d.fusoReferencia) : null;
   if (fim && fim <= inicio) throw new ErroRegra("O limite final precisa ser posterior ao início.");
   const fonteAlocacao=(linha.dadosOrigem as {alocacao?:{inicio?:unknown;fim?:unknown}})?.alocacao; const inicioFonte=typeof fonteAlocacao?.inicio==="string"?fonteAlocacao.inicio.trim():null, fimFonte=typeof fonteAlocacao?.fim==="string"?fonteAlocacao.fim.trim():null; if ((inicioFonte!==d.inicioAlocacao || fimFonte!==(d.fimAlocacao??null)) && !d.complementoVigencia) throw new ErroRegra("Os limites diferem da fotografia e exigem complemento revisado.");
   const [mapaAluno] = await tx.$queryRaw<{alunoId:string}[]>(Prisma.sql`SELECT "alunoId" FROM "MapaOrigemAlunoMigracao" WHERE origem=${linha.origem} AND "alunoOrigemId"=${linha.alunoOrigemId} FOR SHARE`);
   if (!mapaAluno) throw new ErroRegra("O aluno da origem ainda não possui cadastro associado.");
   const [produto] = await tx.$queryRaw<{produtoId:string;paisId:string;moeda:string}[]>(Prisma.sql`SELECT c."produtoId",c."paisId",c.moeda FROM "EnsaioVinculoMigracao" e JOIN "CorrespondenciaProdutoMigracao" c ON c.id=e."correspondenciaProdutoId" WHERE e.id=${d.ensaioId} FOR SHARE`);
   const [turma] = await tx.$queryRaw<{turmaId:string}[]>(Prisma.sql`SELECT c."turmaId" FROM "EnsaioVinculoMigracao" e JOIN "CorrespondenciaTurmaMigracao" c ON c.id=e."correspondenciaTurmaId" WHERE e.id=${d.ensaioId} FOR SHARE`);
   const [status] = await tx.$queryRaw<{statusDestino:StatusMatricula}[]>(Prisma.sql`SELECT c."statusDestino" FROM "EnsaioVinculoMigracao" e JOIN "CorrespondenciaStatusMatriculaMigracao" c ON c.id=e."correspondenciaStatusId" WHERE e.id=${d.ensaioId} FOR SHARE`);
   if (!produto || !turma || !status) throw new ErroRegra("As correspondências do ensaio precisam ser revistas novamente.");
   if (["ENCERRADA","CANCELADA"].includes(status.statusDestino) && !fim) throw new ErroRegra("O estado encerrado exige limite final comprovado.");
   const mapa = await tx.mapaOrigemMatriculaMigracao.findUnique({where:{origem_matriculaOrigemId:{origem:linha.origem,matriculaOrigemId:linha.matriculaOrigemId}}});
   const matriculaId = mapa?.matriculaId ?? randomUUID();
   if (!mapa) { await tx.matricula.create({data:{id:matriculaId,alunoId:mapaAluno.alunoId,produtoId:produto.produtoId,paisId:produto.paisId,moeda:produto.moeda,status:status.statusDestino,diaVencimento:d.diaVencimento,mesesPlano:d.mesesPlano}}); await tx.mapaOrigemMatriculaMigracao.create({data:{id:randomUUID(),origem:linha.origem,matriculaOrigemId:linha.matriculaOrigemId,matriculaId,linhaId:linha.id,entradaHash:d.entradaHash,criadoPorId:autor.id}}); }
   const termos = await tx.termosHistoricosMatriculaMigracao.findUnique({where:{matriculaId}}); if (!termos) await tx.termosHistoricosMatriculaMigracao.create({data:{id:randomUUID(),matriculaId,linhaId:linha.id,entradaHash:d.entradaHash,ensaioId:d.ensaioId,proveniencia:"MIGRACAO",diaVencimento:d.diaVencimento,mesesPlano:d.mesesPlano,evidenciaContrato:d.evidenciaContrato,evidenciaPagamento:d.evidenciaPagamento,revisadoPorId:autor.id}});
   const fatosPersistidos=await tx.fatoSituacaoMatriculaMigracao.findMany({where:{matriculaId},orderBy:{ordem:"asc"},select:{tipo:true,efetivoEm:true,evidencia:true}}); if(fatosPersistidos.length && JSON.stringify(fatosPersistidos.map(f=>({tipo:f.tipo,data:f.efetivoEm.toISOString(),evidencia:canonico(f.evidencia)}))) !== JSON.stringify(d.fatos.map(f=>({tipo:f.tipo,data:instanteDia(f.data,d.fusoReferencia).toISOString(),evidencia:canonico(f.evidencia)})))) throw new ErroRegra("Os fatos enviados divergem do contrato já conferido."); if(!fatosPersistidos.length){ if(d.fatos.at(-1)?.tipo !== ({ATIVA:"ATIVACAO",PAUSADA:"PAUSA",ENCERRADA:"ENCERRAMENTO",CANCELADA:"CANCELAMENTO"} as Record<string,string>)[status.statusDestino]) throw new ErroRegra("Os fatos não comprovam a situação final."); for(const [i,f] of d.fatos.entries()) await tx.fatoSituacaoMatriculaMigracao.create({data:{id:randomUUID(),linhaId:linha.id,entradaHash:d.entradaHash,contextoHash:d.contextoHash,ensaioId:d.ensaioId,matriculaId,ordem:i+1,tipo:f.tipo,efetivoEm:instanteDia(f.data,d.fusoReferencia),evidencia:f.evidencia,conferidoPorId:autor.id}}); }
   const alocacaoId=randomUUID(); await tx.alocacaoTurma.create({data:{id:alocacaoId,alunoId:mapaAluno.alunoId,matriculaId,turmaId:turma.turmaId,ativa:!fim && (status.statusDestino==="ATIVA" || status.statusDestino==="PAUSADA"),provenienciaVinculo:"MIGRACAO",inicioVigencia:inicio,fimVigencia:fim}});
   const snapshot={linhaId:linha.id,entradaHash:d.entradaHash,contextoHash:d.contextoHash,fusoReferencia:d.fusoReferencia,semanticaFim:d.semanticaFim,limites:{inicioVigencia:inicio.toISOString(),fimVigencia:fim?.toISOString()??null},termos:{diaVencimento:d.diaVencimento,mesesPlano:d.mesesPlano},complementoVigencia:d.complementoVigencia??null,evidencias:{contrato:d.evidenciaContrato,pagamento:d.evidenciaPagamento},fatos:d.fatos};
   const aplicacaoId=randomUUID(); await tx.aplicacaoVinculoMigracao.create({data:{id:aplicacaoId,linhaId:linha.id,entradaHash:d.entradaHash,contextoHash:d.contextoHash,ensaioId:d.ensaioId,matriculaId,alocacaoId,fusoReferencia:d.fusoReferencia,semanticaFim:d.semanticaFim,snapshot,aplicadoPorId:autor.id}});
   return {id:aplicacaoId,matriculaId,alocacaoId,repetida:false};
  });
 });
}
