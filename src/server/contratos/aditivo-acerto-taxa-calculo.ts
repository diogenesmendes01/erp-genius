import { Prisma } from "@prisma/client";
import { dinheiro } from "@/server/financeiro/regras";
export function saldoLiquidoAcertoTaxa(valorNegociado: Prisma.Decimal.Value, valorRecebido: Prisma.Decimal.Value | null, valorLiquidadoCredito: Prisma.Decimal.Value, creditosTaxaEmitidos: Prisma.Decimal.Value, compensadoPermuta: Prisma.Decimal.Value = 0) {
  return Prisma.Decimal.max(0, dinheiro(valorNegociado).minus(valorRecebido ?? 0).minus(valorLiquidadoCredito).plus(creditosTaxaEmitidos).minus(dinheiro(compensadoPermuta)));
}

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
  const totalLiquidado = recebido.plus(liquidado);
  const creditoTotalDevido = Prisma.Decimal.max(0, totalLiquidado.minus(novo));
  const creditoNovo = Prisma.Decimal.max(0, creditoTotalDevido.minus(anterior));
  const saldoAposAcerto = saldoLiquidoAcertoTaxa(novo, recebido, liquidado, anterior.plus(creditoNovo));
  return {
    creditoAnterior: anterior,
    creditoNovo,
    creditoTotalDevido,
    saldoAposAcerto,
    pendencia: null as { codigo: "CONCILIAR_CREDITO_EXISTENTE"; valor: Prisma.Decimal; tratamento: string } | null,
  };
}
