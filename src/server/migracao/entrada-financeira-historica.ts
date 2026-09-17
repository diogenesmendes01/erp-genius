"use server";

import { randomUUID } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento } from "@/server/_shared";
import { hashFotografiaFinanceira } from "./fotografia-financeira";
import { DecisaoEntradaFinanceiraHistoricaSchema, EntradaFinanceiraHistoricaSchema, PagadorEntradaFinanceiraHistoricaSchema } from "./entrada-financeira-historica-schema";

const hash = hashFotografiaFinanceira;
const json = (v: unknown) => Prisma.sql`${JSON.stringify(v)}::jsonb`;
type PropostaEntradaRaw = { id:string; status:"PENDENTE"|"APROVADA"|"REJEITADA"|"APLICADA"; preparadorId:string; decisorId:string|null; chaveDecisao:string|null; decisaoHash:string|null; linhaId:string; mapaMatriculaId:string; matriculaId:string; dadosPagador:unknown; entradaHash:string; origem:string; financeiroOrigemId:string; tipoCobranca:string; valor:string; moeda:string; vencimento:Date; competencia:string|null; snapshot:Prisma.JsonValue };

async function financeiroFresco(tx: Prisma.TransactionClient, id: string) {
  const [u] = await tx.$queryRaw<{ ativo: boolean; papeis: Papel[] }[]>(Prisma.sql`SELECT ativo,papeis FROM "Usuario" WHERE id=${id} FOR SHARE`);
  if (!u?.ativo || !u.papeis.some((p) => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao("Exige perfil financeiro ativo.");
}

/** Registra uma proposta imutável sem exigir os destinos ainda inexistentes. */
export async function proporEntradaFinanceiraHistoricaMigracao(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR); const d = EntradaFinanceiraHistoricaSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      await financeiroFresco(tx, autor.id);
      const [linha] = await tx.$queryRaw<{ id:string; origem:string; financeiroOrigemId:string; matriculaOrigemId:string; entradaHash:string; dadosOrigem: Prisma.JsonValue; mapaId:string; matriculaId:string }[]>(Prisma.sql`
        SELECT l.id, lo.origem, l."financeiroOrigemId", l."matriculaOrigemId", l."entradaHash", l."dadosOrigem", m.id AS "mapaId", m."matriculaId"
        FROM "LinhaPreparacaoMigracao" l JOIN "LotePreparacaoMigracao" lo ON lo.id=l."loteId"
        JOIN "MapaOrigemMatriculaMigracao" m ON m.origem=lo.origem AND m."matriculaOrigemId"=l."matriculaOrigemId"
        WHERE l.id=${d.linhaId} AND l."tipoEntrada"='FINANCEIRO_HISTORICO'::"TipoEntradaPreparacaoMigracao" FOR UPDATE`);
      if (!linha?.financeiroOrigemId) throw new ErroRegra("A linha financeira precisa de origem e mapa M01 de matrícula antes da proposta.");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`m01-entrada-financeira:${linha.origem}:${linha.financeiroOrigemId}`}, 0))`;
      const entrada = { ...d, matriculaId: linha.matriculaId, mapaMatriculaId: linha.mapaId };
      const entradaHash = hash(entrada);
      const [replay] = await tx.$queryRaw<{id:string; "entradaHash":string}[]>(Prisma.sql`SELECT id,"entradaHash" FROM "PropostaEntradaFinanceiraHistoricaMigracao" WHERE "preparadorId"=${autor.id} AND "chaveIdempotencia"=${d.chaveIdempotencia} FOR SHARE`);
      if (replay) { if (replay.entradaHash !== entradaHash) throw new ErroRegra("A chave idempotente já representa outra proposta."); return { id: replay.id, repetida: true }; }
      const [jaAplicada] = await tx.$queryRaw<{id:string}[]>(Prisma.sql`SELECT id FROM "AplicacaoEntradaFinanceiraHistoricaMigracao" WHERE origem=${linha.origem} AND "financeiroOrigemId"=${linha.financeiroOrigemId} FOR SHARE`);
      if (jaAplicada) throw new ErroRegra("Esta origem financeira já possui obrigação histórica aplicada.");
      const [ultima] = await tx.$queryRaw<{versao:number}[]>(Prisma.sql`SELECT versao FROM "PropostaEntradaFinanceiraHistoricaMigracao" WHERE origem=${linha.origem} AND "financeiroOrigemId"=${linha.financeiroOrigemId} ORDER BY versao DESC LIMIT 1 FOR SHARE`);
      const snapshot = { linha: { id: linha.id, origem: linha.origem, financeiroOrigemId: linha.financeiroOrigemId, matriculaOrigemId: linha.matriculaOrigemId, entradaHash: linha.entradaHash, dadosOrigem: linha.dadosOrigem }, mapa: { id: linha.mapaId, matriculaId: linha.matriculaId }, matricula: { id: linha.matriculaId } };
      const id = randomUUID();
      await tx.$executeRaw`INSERT INTO "PropostaEntradaFinanceiraHistoricaMigracao" (id,origem,"financeiroOrigemId",versao,"linhaId","mapaMatriculaId","matriculaId","preparadorId","tipoCobranca",valor,moeda,vencimento,competencia,"dadosPagador",evidencia,complemento,entrada,snapshot,"entradaHash","estadoHash","chaveIdempotencia") VALUES (${id},${linha.origem},${linha.financeiroOrigemId},${(ultima?.versao ?? 0) + 1},${linha.id},${linha.mapaId},${linha.matriculaId},${autor.id},${d.tipoCobranca}::"TipoCobranca",${d.valor}::numeric,${d.moeda},${d.vencimento}::date,${d.competencia ?? null},${json(d.pagador)},${json(d.evidencia)},${d.complemento ? json(d.complemento) : Prisma.sql`NULL`},${json(entrada)},${json(snapshot)},${entradaHash},${hash(snapshot)},${d.chaveIdempotencia})`;
      await registrarEvento(tx, { tipo: "PropostaEntradaFinanceiraHistoricaMigracao", agregadoTipo: "Matricula", agregadoId: linha.matriculaId, autorId: autor.id, payload: { propostaId: id, origem: linha.origem, financeiroOrigemId: linha.financeiroOrigemId } });
      return { id, repetida: false };
    });
  });
}

/** Aprovação por outra pessoa aplica somente pagador e obrigação pendente. */
export async function decidirEntradaFinanceiraHistoricaMigracao(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR); const d = DecisaoEntradaFinanceiraHistoricaSchema.parse(input); const decisaoHash = hash({ propostaId: d.propostaId, aprovada: d.aprovada, motivo: d.motivo });
    return prisma.$transaction(async (tx) => {
      await financeiroFresco(tx, autor.id);
      const [p] = await tx.$queryRaw<PropostaEntradaRaw[]>(Prisma.sql`SELECT * FROM "PropostaEntradaFinanceiraHistoricaMigracao" WHERE id=${d.propostaId} FOR UPDATE`);
      if (!p) throw new ErroRegra("Proposta não encontrada."); if (p.preparadorId === autor.id) throw new ErroPermissao("A aprovação exige outra pessoa financeira.");
      if (p.status !== "PENDENTE") { if (p.decisorId === autor.id && p.chaveDecisao === d.chaveIdempotencia && p.decisaoHash === decisaoHash) return { id:p.id, repetida:true }; throw new ErroRegra("A proposta já recebeu uma decisão diferente."); }
      if (!d.aprovada) { await tx.$executeRaw`UPDATE "PropostaEntradaFinanceiraHistoricaMigracao" SET status='REJEITADA',"decisorId"=${autor.id},"chaveDecisao"=${d.chaveIdempotencia},"decisaoHash"=${decisaoHash},"motivoDecisao"=${d.motivo},"decididoEm"=now() WHERE id=${p.id}`; return { id:p.id, rejeitada:true }; }
      const [vigente] = await tx.$queryRaw<{id:string}[]>(Prisma.sql`SELECT m.id FROM "MapaOrigemMatriculaMigracao" m JOIN "LinhaPreparacaoMigracao" l ON l.id=${p.linhaId} JOIN "LotePreparacaoMigracao" lo ON lo.id=l."loteId" WHERE m.id=${p.mapaMatriculaId} AND m."matriculaId"=${p.matriculaId} AND m.origem=lo.origem AND m."matriculaOrigemId"=l."matriculaOrigemId" AND ${json(p.snapshot)}->'linha' IS NOT DISTINCT FROM jsonb_build_object('id',l.id,'origem',lo.origem,'financeiroOrigemId',l."financeiroOrigemId",'matriculaOrigemId',l."matriculaOrigemId",'entradaHash',l."entradaHash",'dadosOrigem',l."dadosOrigem") AND ${json(p.snapshot)}->'mapa' IS NOT DISTINCT FROM jsonb_build_object('id',m.id,'matriculaId',m."matriculaId") FOR SHARE`);
      if (!vigente) throw new ErroRegra("A fotografia da origem ou mapa M01 mudou; crie uma nova proposta.");
      const dadosPagador = PagadorEntradaFinanceiraHistoricaSchema.parse(p.dadosPagador); await tx.$executeRaw`SELECT id FROM "Matricula" WHERE id=${p.matriculaId} FOR UPDATE`; const [ultimo] = await tx.$queryRaw<{versao:number}[]>(Prisma.sql`SELECT versao FROM "PagadorPreparacaoMatricula" WHERE "matriculaId"=${p.matriculaId} ORDER BY versao DESC LIMIT 1 FOR UPDATE`);
      const pagadorId=randomUUID(), cobrancaId=randomUUID(), aplicacaoId=randomUUID(), vencimentoHistorico=p.vencimento.toISOString().slice(0, 10);
      await tx.$executeRaw`UPDATE "PropostaEntradaFinanceiraHistoricaMigracao" SET status='APROVADA',"decisorId"=${autor.id},"chaveDecisao"=${d.chaveIdempotencia},"decisaoHash"=${decisaoHash},"motivoDecisao"=${d.motivo},"decididoEm"=now() WHERE id=${p.id}`;
      await tx.$executeRaw`INSERT INTO "PagadorPreparacaoMatricula" (id,"matriculaId","preparadorId",versao,tipo,dados,motivo,"chaveIdempotencia","entradaHash") VALUES (${pagadorId},${p.matriculaId},${p.preparadorId},${(ultimo?.versao ?? 0)+1},${dadosPagador.tipo},${json(dadosPagador.dados)},${"Pagador histórico M01 aprovado: " + p.id},${"m01-entrada-pagador:" + p.id},${p.entradaHash})`;
      await tx.$executeRaw`INSERT INTO "Cobranca" (id,"matriculaId",tipo,competencia,"valorOriginal","valorNegociado",saldo,moeda,vencimento,status,comentario) VALUES (${cobrancaId},${p.matriculaId},${p.tipoCobranca}::"TipoCobranca",${p.competencia ?? null},${p.valor}::numeric,${p.valor}::numeric,${p.valor}::numeric,${p.moeda},${vencimentoHistorico}::date,'PENDENTE'::"StatusCobranca",${"Obrigação histórica M01; sem recebimento, quitação ou crédito. Proposta " + p.id})`;
      await tx.$executeRaw`INSERT INTO "AplicacaoEntradaFinanceiraHistoricaMigracao" (id,"propostaId",origem,"financeiroOrigemId","pagadorId","cobrancaId","aplicadaPorId",snapshot) VALUES (${aplicacaoId},${p.id},${p.origem},${p.financeiroOrigemId},${pagadorId},${cobrancaId},${autor.id},${json({ propostaId:p.id, pagadorId, cobrancaId, semRecebimento:true })})`;
      await tx.$executeRaw`UPDATE "PropostaEntradaFinanceiraHistoricaMigracao" SET status='APLICADA',"aplicadaEm"=now() WHERE id=${p.id}`;
      await registrarEvento(tx, { tipo: "EntradaFinanceiraHistoricaMigracaoAplicada", agregadoTipo: "Cobranca", agregadoId: cobrancaId, autorId: autor.id, payload: { propostaId:p.id, origem:p.origem, financeiroOrigemId:p.financeiroOrigemId, pagadorId, cobrancaId, semRecebimento:true } });
      return { id:p.id, pagadorId, cobrancaId };
    });
  });
}

export async function consultarEntradasFinanceirasHistoricasMigracao(linhaId: string) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR); z.string().min(1).parse(linhaId);
    return prisma.$transaction(async (tx) => {
      await financeiroFresco(tx, autor.id);
      const itens = await tx.$queryRaw<{ id:string; versao:number; status:string; "preparadorId":string; "preparadorNome":string|null; "decisorNome":string|null; "motivoDecisao":string|null; "criadoEm":Date; "aplicadaEm":Date|null; valor:Prisma.Decimal; moeda:string; vencimento:Date; competencia:string|null; "tipoCobranca":string; "dadosPagador":Prisma.JsonValue; evidencia:Prisma.JsonValue; complemento:Prisma.JsonValue; "cobrancaId":string|null; "pagadorId":string|null }[]>(Prisma.sql`
        SELECT p.id,p.versao,p.status,p."preparadorId",u.nome AS "preparadorNome",d.nome AS "decisorNome",p."motivoDecisao",p."criadoEm",p."aplicadaEm",p.valor,p.moeda,p.vencimento,p.competencia,p."tipoCobranca",p."dadosPagador",p.evidencia,p.complemento,a."cobrancaId",a."pagadorId"
        FROM "PropostaEntradaFinanceiraHistoricaMigracao" p JOIN "Usuario" u ON u.id=p."preparadorId" LEFT JOIN "Usuario" d ON d.id=p."decisorId" LEFT JOIN "AplicacaoEntradaFinanceiraHistoricaMigracao" a ON a."propostaId"=p.id
        WHERE p."linhaId"=${linhaId} ORDER BY p.versao DESC`);
      return itens.map((p) => ({ ...p, valor:p.valor.toString(), vencimento:p.vencimento.toISOString(), criadoEm:p.criadoEm.toISOString(), aplicadaEm:p.aplicadaEm?.toISOString() ?? null, podeDecidir:p.status === "PENDENTE" && p.preparadorId !== autor.id }));
    });
  });
}

export async function listarPaisesEntradaFinanceiraHistoricaMigracao() {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    return prisma.$transaction(async (tx) => { await financeiroFresco(tx, autor.id); const paises = await tx.pais.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true, codigoISO: true } }); return paises.map((pais) => ({ id: pais.id, nome: pais.nome, codigo: pais.codigoISO })); });
  });
}
