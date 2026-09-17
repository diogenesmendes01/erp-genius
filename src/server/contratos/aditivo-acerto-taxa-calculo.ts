import { Prisma } from "@prisma/client";
import { dinheiro } from "@/server/financeiro/regras";
export function saldoLiquidoAcertoTaxa(valorNegociado: Prisma.Decimal.Value, valorRecebido: Prisma.Decimal.Value | null, valorLiquidadoCredito: Prisma.Decimal.Value, creditosTaxaEmitidos: Prisma.Decimal.Value) {
  return Prisma.Decimal.max(0, dinheiro(valorNegociado).minus(valorRecebido ?? 0).minus(valorLiquidadoCredito).plus(creditosTaxaEmitidos));
}

/**
 * Crédito de taxa é cumulativo por cobrança: só a diferença ainda não
 * originada pode virar novo crédito. Uma elevação posterior fica pendente de
 * conciliação aprovada do crédito já entregue; não cria cobrança nem retira
 * crédito automaticamente.
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
  // A quitação por crédito é valor já entregue pelo aluno para esta cobrança.
  // Reduzir a taxa depois dela precisa preservar a diferença ao aluno, tal como
  // uma quitação em dinheiro. Não se cria uma nova utilização: só a diferença
  // entre o total liquidado e a nova taxa vira CréditoMatricula.
  const totalLiquidado = recebido.plus(liquidado);
  const creditoTotalDevido = Prisma.Decimal.max(0, totalLiquidado.minus(novo));
  const creditoNovo = Prisma.Decimal.max(0, creditoTotalDevido.minus(anterior));
  // Crédito já emitido continua sendo um direito do aluno, inclusive se já foi
  // usado ou devolvido. Em aumento posterior ele deixa de ser abatido duas
  // vezes da mesma cobrança: a projeção usa a liquidação líquida L - C.
  const saldoAposAcerto = saldoLiquidoAcertoTaxa(novo, recebido, liquidado, anterior.plus(creditoNovo));
  return {
    creditoAnterior: anterior,
    creditoNovo,
    creditoTotalDevido,
    saldoAposAcerto,
    pendencia: null as { codigo: "CONCILIAR_CREDITO_EXISTENTE"; valor: Prisma.Decimal; tratamento: string } | null,
  };
}
