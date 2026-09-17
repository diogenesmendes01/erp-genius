"use server";

import { createHash, randomUUID } from "node:crypto";
import { Papel, Prisma, TipoCobranca } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento } from "@/server/_shared";

const evidencia = z.record(z.string().trim().min(1), z.union([z.string().trim().min(1), z.number().finite(), z.boolean()])).refine((v) => Object.keys(v).length > 0, "Informe evidência verificável.");
const pagador = z.object({ tipo: z.enum(["ALUNO", "RESPONSAVEL", "EMPRESA"]), dados: z.object({ nome: z.string().trim().min(1).max(200), paisId: z.string().min(1), documento: z.string().trim().max(100).optional(), email: z.string().trim().email().max(254).optional(), telefoneE164: z.string().regex(/^\+[1-9]\d{7,14}$/).optional(), endereco: z.string().trim().max(1000).optional() }).strict() }).strict();
export const EntradaFinanceiraHistoricaSchema = z.object({
  linhaId: z.string().min(1), tipoCobranca: z.nativeEnum(TipoCobranca), valor: z.string().regex(/^\d+(\.\d{1,2})?$/), moeda: z.string().regex(/^[A-Z]{3}$/), vencimento: z.string().date(), competencia: z.string().regex(/^\d{4}-\d{2}$/).optional(), pagador, evidencia, complemento: z.record(z.string().trim().min(1), z.string().trim().min(1)).optional(), chaveIdempotencia: z.string().uuid(),
}).strict();
const decisao = z.object({ propostaId: z.string().min(1), aprovada: z.boolean(), motivo: z.string().trim().min(10).max(1000), chaveIdempotencia: z.string().uuid() }).strict();
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v, Object.keys(v as object).sort())).digest("hex");
const json = (v: unknown) => Prisma.sql`${JSON.stringify(v)}::jsonb`;
type PropostaEntradaRaw = { id:string; status:"PENDENTE"|"APROVADA"|"REJEITADA"|"APLICADA"; preparadorId:string; decisorId:string|null; chaveDecisao:string|null; linhaId:string; mapaMatriculaId:string; matriculaId:string; dadosPagador:unknown; entradaHash:string; origem:string; financeiroOrigemId:string; tipoCobranca:string; valor:string; moeda:string; vencimento:Date };

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
      await tx.$executeRaw`INSERT INTO "PropostaEntradaFinanceiraHistoricaMigracao" (id,origem,"financeiroOrigemId",versao,"linhaId","mapaMatriculaId","matriculaId","preparadorId","tipoCobranca",valor,moeda,vencimento,competencia,"dadosPagador",evidencia,complemento,entrada,snapshot,"entradaHash","estadoHash","chaveIdempotencia") VALUES (${id},${linha.origem},${linha.financeiroOrigemId},${(ultima?.versao ?? 0) + 1},${linha.id},${linha.mapaId},${linha.matriculaId},${autor.id},${d.tipoCobranca}::"TipoCobranca",${d.valor}::numeric,${d.moeda},${new Date(`${d.vencimento}T00:00:00.000Z`)},${d.competencia ?? null},${json(d.pagador)},${json(d.evidencia)},${d.complemento ? json(d.complemento) : Prisma.sql`NULL`},${json(entrada)},${json(snapshot)},${entradaHash},${hash(snapshot)},${d.chaveIdempotencia})`;
      await registrarEvento(tx, { tipo: "PropostaEntradaFinanceiraHistoricaMigracao", agregadoTipo: "Matricula", agregadoId: linha.matriculaId, autorId: autor.id, payload: { propostaId: id, origem: linha.origem, financeiroOrigemId: linha.financeiroOrigemId } });
      return { id, repetida: false };
    });
  });
}

/** Aprovação por outra pessoa aplica somente pagador e obrigação pendente. */
export async function decidirEntradaFinanceiraHistoricaMigracao(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR); const d = decisao.parse(input);
    return prisma.$transaction(async (tx) => {
      await financeiroFresco(tx, autor.id);
      const [p] = await tx.$queryRaw<PropostaEntradaRaw[]>(Prisma.sql`SELECT * FROM "PropostaEntradaFinanceiraHistoricaMigracao" WHERE id=${d.propostaId} FOR UPDATE`);
      if (!p) throw new ErroRegra("Proposta não encontrada."); if (p.preparadorId === autor.id) throw new ErroPermissao("A aprovação exige outra pessoa financeira.");
      if (p.status !== "PENDENTE") { if (p.decisorId === autor.id && p.chaveDecisao === d.chaveIdempotencia) return { id:p.id, repetida:true }; throw new ErroRegra("A proposta já foi decidida."); }
      if (!d.aprovada) { await tx.$executeRaw`UPDATE "PropostaEntradaFinanceiraHistoricaMigracao" SET status='REJEITADA',"decisorId"=${autor.id},"chaveDecisao"=${d.chaveIdempotencia},"motivoDecisao"=${d.motivo},"decididoEm"=now() WHERE id=${p.id}`; return { id:p.id, rejeitada:true }; }
      const [vigente] = await tx.$queryRaw<{id:string}[]>(Prisma.sql`SELECT m.id FROM "MapaOrigemMatriculaMigracao" m JOIN "LinhaPreparacaoMigracao" l ON l.id=${p.linhaId} JOIN "LotePreparacaoMigracao" lo ON lo.id=l."loteId" WHERE m.id=${p.mapaMatriculaId} AND m."matriculaId"=${p.matriculaId} AND m.origem=lo.origem AND m."matriculaOrigemId"=l."matriculaOrigemId" FOR SHARE`);
      if (!vigente) throw new ErroRegra("O mapa M01 mudou; crie uma nova proposta.");
      const dadosPagador = pagador.parse(p.dadosPagador); const [ultimo] = await tx.$queryRaw<{versao:number}[]>(Prisma.sql`SELECT versao FROM "PagadorPreparacaoMatricula" WHERE "matriculaId"=${p.matriculaId} ORDER BY versao DESC LIMIT 1 FOR UPDATE`);
      const pagadorId=randomUUID(), cobrancaId=randomUUID(), aplicacaoId=randomUUID();
      await tx.$executeRaw`UPDATE "PropostaEntradaFinanceiraHistoricaMigracao" SET status='APROVADA',"decisorId"=${autor.id},"chaveDecisao"=${d.chaveIdempotencia},"motivoDecisao"=${d.motivo},"decididoEm"=now() WHERE id=${p.id}`;
      await tx.$executeRaw`INSERT INTO "PagadorPreparacaoMatricula" (id,"matriculaId","preparadorId",versao,tipo,dados,motivo,"chaveIdempotencia","entradaHash") VALUES (${pagadorId},${p.matriculaId},${p.preparadorId},${(ultimo?.versao ?? 0)+1},${dadosPagador.tipo},${json(dadosPagador.dados)},${"Pagador histórico M01 aprovado: " + p.id},${"m01-entrada-pagador:" + p.id},${p.entradaHash})`;
      await tx.$executeRaw`INSERT INTO "Cobranca" (id,"matriculaId",tipo,"valorOriginal","valorNegociado",saldo,moeda,vencimento,status,comentario) VALUES (${cobrancaId},${p.matriculaId},${p.tipoCobranca}::"TipoCobranca",${p.valor}::numeric,${p.valor}::numeric,${p.valor}::numeric,${p.moeda},${p.vencimento},'PENDENTE'::"StatusCobranca",${"Obrigação histórica M01; sem recebimento, quitação ou crédito. Proposta " + p.id})`;
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
      const itens = await tx.$queryRaw<{ id:string; versao:number; status:string; "preparadorId":string; "preparadorNome":string|null; "decisorNome":string|null; "motivoDecisao":string|null; "criadoEm":Date; "aplicadaEm":Date|null; valor:Prisma.Decimal; moeda:string; "tipoCobranca":string; "cobrancaId":string|null; "pagadorId":string|null }[]>(Prisma.sql`
        SELECT p.id,p.versao,p.status,p."preparadorId",u.nome AS "preparadorNome",d.nome AS "decisorNome",p."motivoDecisao",p."criadoEm",p."aplicadaEm",p.valor,p.moeda,p."tipoCobranca",a."cobrancaId",a."pagadorId"
        FROM "PropostaEntradaFinanceiraHistoricaMigracao" p JOIN "Usuario" u ON u.id=p."preparadorId" LEFT JOIN "Usuario" d ON d.id=p."decisorId" LEFT JOIN "AplicacaoEntradaFinanceiraHistoricaMigracao" a ON a."propostaId"=p.id
        WHERE p."linhaId"=${linhaId} ORDER BY p.versao DESC`);
      return itens.map((p) => ({ ...p, valor:p.valor.toString(), criadoEm:p.criadoEm.toISOString(), aplicadaEm:p.aplicadaEm?.toISOString() ?? null, podeDecidir:p.status === "PENDENTE" && p.preparadorId !== autor.id }));
    });
  });
}
