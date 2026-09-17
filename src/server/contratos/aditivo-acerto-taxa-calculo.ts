import { Prisma } from "@prisma/client";
import { dinheiro } from "@/server/financeiro/regras";

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
  const valorPendenteConciliacao = Prisma.Decimal.max(0, anterior.minus(creditoTotalDevido));
  return {
    creditoAnterior: anterior,
    creditoNovo: Prisma.Decimal.max(0, creditoTotalDevido.minus(anterior)),
    creditoTotalDevido,
    saldoAposAcerto: Prisma.Decimal.max(0, novo.minus(totalLiquidado)),
    pendencia: valorPendenteConciliacao.gt(0) ? {
      codigo: "CONCILIAR_CREDITO_EXISTENTE" as const,
      valor: valorPendenteConciliacao,
      tratamento: "O Financeiro deve conciliar o crédito de taxa já disponibilizado, com decisão independente, antes de repropor o aumento. Esta prévia não debita nem devolve valores automaticamente.",
    } : null,
  };
}
