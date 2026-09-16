import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { saldoAtual } from "./regras";
export async function saldoCreditoTx(tx: Prisma.TransactionClient, creditoId: string) {
  const credito = await tx.creditoMatricula.findUniqueOrThrow({ where: { id: creditoId } });
  const usos = await tx.propostaUsoCredito.aggregate({ where: { creditoId, decisao: { aprovada: true } }, _sum: { valor: true } });
  return credito.valorInicial.minus(usos._sum.valor ?? 0);
}
export async function estadoUsoCreditoTx(tx: Prisma.TransactionClient, creditoId: string, cobrancaId: string, valor: Prisma.Decimal) {
  const credito = await tx.creditoMatricula.findUniqueOrThrow({ where: { id: creditoId } });
  if (!await tx.cobranca.count({ where: { id: cobrancaId, matriculaId: credito.matriculaId } })) throw new ErroRegra("Escolha uma cobrança da mesma matrícula do crédito.");
  await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE id = ${cobrancaId} FOR UPDATE`;
  const c = await tx.cobranca.findUniqueOrThrow({ where: { id: cobrancaId }, include: { recebimentos: { orderBy: { id: "asc" } }, informes: { where: { status: "A_CONFERIR" }, select: { id: true } } } });
  const recebido = new Prisma.Decimal(c.valorRecebido ?? 0), somaRecebimentos = c.recebimentos.reduce((s, r) => s.plus(r.valor), new Prisma.Decimal(0));
  const saldo = saldoAtual(c.valorNegociado, recebido, c.valorLiquidadoCredito), disponivel = await saldoCreditoTx(tx, creditoId);
  if (!["PENDENTE", "ATRASADO"].includes(c.status) || c.canceladaPorPausaId || c.suspensaPorItemPausaId || c.informes.length || c.moeda !== credito.moeda || !recebido.equals(somaRecebimentos) || c.recebimentos.some(r => r.moeda !== c.moeda) || (c.saldo !== null && !c.saldo.equals(saldo))) throw new ErroRegra("Confira estado, moeda, informes, recebimentos e saldo da cobrança antes de propor o abatimento.");
  if (valor.lte(0) || valor.gt(disponivel) || valor.gt(saldo)) throw new ErroRegra("Valor excede o crédito ou o saldo da cobrança.");
  return { credito, c, snapshot: {
    matriculaId: credito.matriculaId, moeda: credito.moeda, creditoId: credito.id, origemLiberacaoId: credito.origemLiberacaoId, valorCredito: disponivel.toFixed(2),
    ...(credito.origemAcertoId ? { origemAcertoId: credito.origemAcertoId } : {}),
    ...(credito.origemPeriodoIntegralId ? { origemPeriodoIntegralId: credito.origemPeriodoIntegralId } : {}),
    cobrancaId: c.id, cobrancaVersao: c.versao, valorNegociado: c.valorNegociado.toFixed(2), recebido: recebido.toFixed(2), saldoAntes: saldo.toFixed(2),
    ...(c.valorLiquidadoCredito.gt(0) ? { creditoLiquidadoAnterior: c.valorLiquidadoCredito.toFixed(2) } : {}),
    valorProposto: valor.toFixed(2), saldoCobrancaProposto: saldo.minus(valor).toFixed(2), saldoCreditoProposto: disponivel.minus(valor).toFixed(2),
    recebimentosIds: c.recebimentos.map(r => r.id), aplicada: false,
  } };
}
