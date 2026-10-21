import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";

/** Crédito do encontro pago pela proporção original; diferenças de centavos ficam no acumulado da compra. */
export async function calcularCreditoHorasTx(tx: Prisma.TransactionClient, reservaId: string) {
  const r = await tx.reservaHorasCompradas.findUniqueOrThrow({ where: { id: reservaId }, include: { compra: true } });
  const anteriores = await tx.creditoMatricula.findMany({ where: { origemLiberacao: { reserva: { compraId: r.compraId } } },
    select: { id: true, valorInicial: true, origemLiberacao: { select: { reserva: { select: { minutos: true } } } } }, orderBy: { id: "asc" } });
  const minutosAnteriores = anteriores.reduce((s, c) => {
    if (!c.origemLiberacao) throw new ErroRegra("Crédito anterior sem origem de cancelamento conferida.");
    return s + c.origemLiberacao.reserva.minutos;
  }, 0);
  const valorAnterior = anteriores.reduce((s, c) => s.plus(c.valorInicial), new Prisma.Decimal(0));
  if (minutosAnteriores + r.minutos > r.compra.minutosComprados) throw new ErroRegra("Conversões excedem a quantidade comprada.");
  const acumulado = r.compra.valorPagoAlocado.mul(minutosAnteriores + r.minutos).div(r.compra.minutosComprados).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const valor = acumulado.minus(valorAnterior);
  if (valor.lt(0)) throw new ErroRegra("Confira os créditos anteriores da compra.");
  return { compraId: r.compraId, moeda: r.compra.moeda, minutosComprados: r.compra.minutosComprados, minutosConvertidos: r.minutos,
    valorPagoOriginal: r.compra.valorPagoAlocado.toFixed(2), descontoOriginal: r.compra.descontoOriginal.toFixed(2), minutosAnteriores, valorAnterior: valorAnterior.toFixed(2),
    valorAcumulado: acumulado.toFixed(2), valorCredito: valor.toFixed(2), creditosAnterioresIds: anteriores.map(c => c.id), regra: "PROPORCAO_PAGA_ORIGINAL_ACUMULADA_2_CASAS_HALF_UP" };
}
