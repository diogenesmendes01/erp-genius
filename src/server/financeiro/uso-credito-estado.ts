import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { saldoAtual } from "./regras";
export async function saldoCreditoTx(tx: Prisma.TransactionClient, creditoId: string) {
  const credito = await tx.creditoMatricula.findUniqueOrThrow({ where: { id: creditoId } });
  const usos = await tx.propostaUsoCredito.aggregate({ where: { creditoId, decisao: { aprovada: true } }, _sum: { valor: true } });
  const reservas = await tx.reservaDevolucaoCredito.aggregate({ where: { creditoId, estado: { not: "LIBERADA" } }, _sum: { valor: true } });
  return credito.valorInicial.minus(usos._sum.valor ?? 0).minus(reservas._sum.valor ?? 0);
}
export async function estadoUsoCreditoTx(tx: Prisma.TransactionClient, creditoId: string, cobrancaId: string, valor: Prisma.Decimal) {
  const credito = await tx.creditoMatricula.findUniqueOrThrow({ where: { id: creditoId } });
  if (!await tx.cobranca.count({ where: { id: cobrancaId, matriculaId: credito.matriculaId } })) throw new ErroRegra("Escolha uma cobrança da mesma matrícula do crédito.");
  await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE id = ${cobrancaId} FOR UPDATE`;
  const c = await tx.cobranca.findUniqueOrThrow({ where: { id: cobrancaId }, include: { destinacoesRecebimento: { orderBy: { id: "asc" }, include: { recebimento: { select: { id: true, moeda: true } } } }, informes: { where: { status: "A_CONFERIR" }, select: { id: true } } } });
  const recebido = new Prisma.Decimal(c.valorRecebido ?? 0), somaRecebimentos = c.destinacoesRecebimento.reduce((s, d) => s.plus(d.valor), new Prisma.Decimal(0));
  const saldo = saldoAtual(c.valorNegociado, recebido, c.valorLiquidadoCredito), disponivel = await saldoCreditoTx(tx, creditoId);
  if (!["PENDENTE", "ATRASADO"].includes(c.status) || c.canceladaPorPausaId || c.suspensaPorItemPausaId || c.informes.length || c.moeda !== credito.moeda || !recebido.equals(somaRecebimentos) || c.destinacoesRecebimento.some(d => d.recebimento.moeda !== c.moeda) || (c.saldo !== null && !c.saldo.equals(saldo))) throw new ErroRegra("Confira estado, moeda, informes, destinações e saldo da cobrança antes de propor o abatimento.");
  if (valor.lte(0) || valor.gt(disponivel) || valor.gt(saldo)) throw new ErroRegra("Valor excede o crédito ou o saldo da cobrança.");
  return { credito, c, snapshot: {
    matriculaId: credito.matriculaId, moeda: credito.moeda, creditoId: credito.id, origemLiberacaoId: credito.origemLiberacaoId, valorCredito: disponivel.toFixed(2),
    ...(credito.origemAcertoId ? { origemAcertoId: credito.origemAcertoId } : {}),
    ...(credito.origemPeriodoIntegralId ? { origemPeriodoIntegralId: credito.origemPeriodoIntegralId } : {}),
    ...(credito.origemDestinacaoRecebimentoId ? { origemDestinacaoRecebimentoId: credito.origemDestinacaoRecebimentoId } : {}),
    cobrancaId: c.id, cobrancaVersao: c.versao, valorNegociado: c.valorNegociado.toFixed(2), recebido: recebido.toFixed(2), saldoAntes: saldo.toFixed(2),
    ...(c.valorLiquidadoCredito.gt(0) ? { creditoLiquidadoAnterior: c.valorLiquidadoCredito.toFixed(2) } : {}),
    valorProposto: valor.toFixed(2), saldoCobrancaProposto: saldo.minus(valor).toFixed(2), saldoCreditoProposto: disponivel.minus(valor).toFixed(2),
    destinacoesRecebimentoIds: c.destinacoesRecebimento.map(d => d.id), aplicada: false,
  } };
}
