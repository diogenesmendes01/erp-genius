import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { dinheiro } from "@/server/financeiro/regras";

/**
 * Crédito de taxa é cumulativo por cobrança: só a diferença ainda não
 * originada pode virar novo crédito. Uma elevação posterior exige conciliar o
 * crédito já entregue antes de mudar a dívida.
 */
export function calcularCreditoAcertoTaxa(input: {
  valorRecebido: Prisma.Decimal.Value | null;
  valorLiquidadoCredito: Prisma.Decimal.Value;
  valorNovo: Prisma.Decimal.Value;
  creditosTaxaJaOriginados: Prisma.Decimal.Value;
}) {
  const recebido = dinheiro(input.valorRecebido ?? 0);
  const liquidado = dinheiro(input.valorLiquidadoCredito);
  const novo = dinheiro(input.valorNovo);
  const anterior = dinheiro(input.creditosTaxaJaOriginados);
  const creditoTotalDevido = Prisma.Decimal.max(0, recebido.minus(novo));
  if (creditoTotalDevido.lt(anterior)) {
    throw new ErroRegra("O aumento da taxa exige conciliar o crédito já originado antes de aplicar o aditivo.");
  }
  return {
    creditoAnterior: anterior,
    creditoNovo: creditoTotalDevido.minus(anterior),
    creditoTotalDevido,
    saldoAposAcerto: Prisma.Decimal.max(0, novo.minus(recebido).minus(liquidado)),
  };
}
