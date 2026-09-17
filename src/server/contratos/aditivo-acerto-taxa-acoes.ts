"use server";
import { Papel, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { hashSubstituicao } from "./substituicao-estado";
import { carregarEstadoConferenciaFinalAditivoTx } from "./aditivo-conferencia-final-estado";
import { calcularCreditoAcertoTaxa } from "./aditivo-acerto-taxa-calculo";
import { AplicarAcertoTaxaSchema, DecidirAcertoTaxaSchema, ProporAcertoTaxaSchema } from "./aditivo-acerto-taxa-acoes-schema";

async function financeiroAtual(tx: Prisma.TransactionClient, id: string, aprovar = false) {
  const u = await tx.usuario.findUnique({ where: { id }, select: { ativo: true, papeis: true, permissoes: true } });
  if (!u?.ativo || !(u.papeis.includes(Papel.ADMINISTRADOR) || u.papeis.includes(Papel.FINANCEIRO)) || (aprovar && !u.papeis.includes(Papel.ADMINISTRADOR) && !u.permissoes.includes("financeiro.aprovar_acertos"))) throw new ErroPermissao("Exige Financeiro ativo e permissão vigente.");
}

/** Proposta só fotografa uma cobrança real; nunca emite ou reativa taxa. */
export async function proporAcertoTaxaAditivo(input: unknown) {
 return executarAcao(async () => { const autor = await exigirSessaoComPapel(Papel.FINANCEIRO); const d = ProporAcertoTaxaSchema.parse(input);
  return prisma.$transaction(async tx => { await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id=${d.matriculaId} FOR UPDATE`; await financeiroAtual(tx, autor.id);
   const estado = await carregarEstadoConferenciaFinalAditivoTx(tx, { matriculaId: d.matriculaId, propostaId: d.propostaAditivoId, conclusaoId: d.conclusaoId });
   if (estado.revisaoHash !== d.revisaoHash || estado.dados.ambiente !== "PRODUCAO") throw new ErroRegra("A conclusão em produção e sua revisão exata são obrigatórias.");
   const v = await tx.versaoCondicoesAditivo.findFirst({ where: { matriculaId: d.matriculaId, propostaId: d.propostaAditivoId }, orderBy: { versao: "desc" } });
   const c = await tx.cobranca.findFirst({ where: { id: d.cobrancaId, matriculaId: d.matriculaId, tipo: "MATRICULA" } });
   if (!v || !c) throw new ErroRegra("Selecione uma cobrança de taxa real da matrícula.");
   const cond = v.condicoes as Record<string, any>, valor = cond.TAXA_VALOR?.valor ? new Prisma.Decimal(cond.TAXA_VALOR.valor) : c.valorNegociado, vencimento = cond.TAXA_VENCIMENTO?.data ? new Date(`${cond.TAXA_VENCIMENTO.data}T00:00:00.000Z`) : c.vencimento;
   const anteriores = await tx.origemCreditoAcertoTaxaAditivo.aggregate({ where: { cobrancaId: c.id }, _sum: { valor: true } });
   const calc = calcularCreditoAcertoTaxa({ valorRecebido: c.valorRecebido, valorLiquidadoCredito: c.valorLiquidadoCredito, valorNovo: valor, creditosTaxaJaOriginados: anteriores._sum.valor ?? 0 });
   if (calc.pendencia) throw new ErroRegra(`${calc.pendencia.tratamento} Valor a conciliar: ${calc.pendencia.valor.toFixed(2)}.`);
   const fotografia = { revisaoHash: estado.revisaoHash, condicoesHash: v.condicoesHash, versaoCondicoesId: v.id, cobranca: { id: c.id, versao: c.versao, moeda: c.moeda, valorNegociado: c.valorNegociado.toFixed(2), valorRecebido: c.valorRecebido?.toFixed(2) ?? null, valorLiquidadoCredito: c.valorLiquidadoCredito.toFixed(2), vencimento: c.vencimento.toISOString() }, calculo: { creditoAnterior: calc.creditoAnterior.toFixed(2), creditoNovo: calc.creditoNovo.toFixed(2) } }, fotografiaHash = hashSubstituicao(fotografia);
   const repetida = await tx.propostaAcertoTaxaAditivo.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
   if (repetida) { if (repetida.fotografiaHash !== fotografiaHash) throw new ErroRegra("A chave idempotente já foi usada com outra proposta."); return { id: repetida.id, status: repetida.status }; }
   const p = await tx.propostaAcertoTaxaAditivo.create({ data: { id: randomUUID(), matriculaId: d.matriculaId, propostaAditivoId: d.propostaAditivoId, conferenciaFinalId: v.conferenciaFinalId, versaoCondicoesId: v.id, cobrancaId: c.id, preparadorId: autor.id, valorNovo: valor, vencimentoNovo: vencimento, creditoAnterior: calc.creditoAnterior, creditoNovo: calc.creditoNovo, evidencia: d.evidencia, motivo: d.motivo, fotografia, fotografiaHash, chaveIdempotencia: d.chaveIdempotencia } });
   await registrarEvento(tx, { tipo: "AcertoTaxaAditivoProposto", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id, payload: { propostaId: p.id, cobrancaId: c.id, fotografiaHash } }); return { id: p.id, status: p.status };
  });
 });
}

export async function decidirAcertoTaxaAditivo(input: unknown) {
 return executarAcao(async () => { const autor = await exigirSessaoComPapel(Papel.FINANCEIRO); const d = DecidirAcertoTaxaSchema.parse(input);
  return prisma.$transaction(async tx => { await financeiroAtual(tx, autor.id, true); const p = await tx.propostaAcertoTaxaAditivo.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: true } });
   if (p.preparadorId === autor.id) throw new ErroRegra("A decisão exige outro Financeiro.");
   if (p.decisao) { if (p.decisao.decisorId !== autor.id || p.decisao.aprovada !== d.aprovada || p.decisao.motivo !== d.motivo) throw new ErroRegra("A proposta já recebeu outra decisão."); return { id: p.decisao.id, aprovada: p.decisao.aprovada }; }
   if (p.status !== "PENDENTE") throw new ErroRegra("A proposta não está pendente."); const decisao = await tx.decisaoAcertoTaxaAditivo.create({ data: { id: randomUUID(), propostaId: p.id, decisorId: autor.id, aprovada: d.aprovada, motivo: d.motivo, fotografiaHash: p.fotografiaHash, chaveIdempotencia: d.chaveIdempotencia } });
   await tx.propostaAcertoTaxaAditivo.update({ where: { id: p.id }, data: { status: d.aprovada ? "APROVADA" : "REJEITADA" } }); return { id: decisao.id, aprovada: decisao.aprovada };
  });
 });
}

export async function aplicarAcertoTaxaAditivo(input: unknown) {
 return executarAcao(async () => { const autor = await exigirSessaoComPapel(Papel.FINANCEIRO); const d = AplicarAcertoTaxaSchema.parse(input);
  return prisma.$transaction(async tx => { await financeiroAtual(tx, autor.id, true); const p = await tx.propostaAcertoTaxaAditivo.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: true, cobranca: true } });
   if (!p.decisao?.aprovada || p.decisao.decisorId !== autor.id || p.status !== "APROVADA") throw new ErroRegra("A aplicação exige decisão aprovada do executor independente.");
   const c = p.cobranca; const app = await tx.aplicacaoAcertoTaxaAditivo.create({ data: { id: randomUUID(), propostaId: p.id, decisaoId: p.decisao.id, cobrancaId: c.id, executorId: autor.id, versaoAnterior: c.versao, valorAnterior: c.valorNegociado, valorNovo: p.valorNovo, vencimentoAnterior: c.vencimento, vencimentoNovo: p.vencimentoNovo, creditoAnterior: p.creditoAnterior, creditoNovo: p.creditoNovo, fotografia: p.fotografia } });
   const saldo = Prisma.Decimal.max(0, p.valorNovo.minus(c.valorRecebido ?? 0).minus(c.valorLiquidadoCredito));
   await tx.cobranca.update({ where: { id: c.id }, data: { valorNegociado: p.valorNovo, vencimento: p.vencimentoNovo, saldo, status: saldo.isZero() ? "PAGO" : c.status === "PAGO" ? "PENDENTE" : c.status, versao: { increment: 1 } } });
   if (p.creditoNovo.gt(0)) { const origem = await tx.origemCreditoAcertoTaxaAditivo.create({ data: { id: randomUUID(), aplicacaoId: app.id, matriculaId: p.matriculaId, cobrancaId: c.id, valor: p.creditoNovo, moeda: c.moeda, fotografia: p.fotografia } }); await tx.creditoMatricula.create({ data: { matriculaId: p.matriculaId, moeda: c.moeda, valorInicial: p.creditoNovo, valorDisponivel: p.creditoNovo, origemAcertoTaxaAditivoId: origem.id } }); }
   await tx.propostaAcertoTaxaAditivo.update({ where: { id: p.id }, data: { status: "APLICADA" } }); return { id: app.id, aplicada: true };
  });
 });
}
