import type { Prisma } from "@prisma/client";
import { z } from "zod";

/**
 * Origem da diferença entre o valor original gravado na compra e o valor pago (`descontoOriginal`).
 * Q172: com aditivo de adiantamento aplicado antes do pagamento, a cobrança conserva o valor original
 * da emissão e passa ao valor do aditivo; se ele for menor, a diferença é redução contratual, não desconto.
 * Sem dependência de execução do Prisma: os rótulos também servem às telas.
 * A memória da compra registra a aplicação em `snapshot.preparacao.aplicacaoAdiantamentoAditivoId`.
 */
export type OrigemDiferencaCompra = "DESCONTO" | "REDUCAO_ADITIVO";

export const ROTULO_DIFERENCA_COMPRA: Record<OrigemDiferencaCompra, string> = {
  DESCONTO: "Desconto original",
  REDUCAO_ADITIVO: "Redução do adiantamento por aditivo",
};

/** Rótulo da mesma diferença na memória de cálculo do crédito, que já a desconsidera do valor pago. */
export const ROTULO_DIFERENCA_CREDITO: Record<OrigemDiferencaCompra, string> = {
  DESCONTO: "Desconto original já considerado",
  REDUCAO_ADITIVO: "Redução do adiantamento por aditivo já considerada",
};

const ComAditivo = z.object({ preparacao: z.object({ aplicacaoAdiantamentoAditivoId: z.string().min(1) }) });

export function origemDiferencaCompra(snapshot: unknown, diferenca: Prisma.Decimal): OrigemDiferencaCompra {
  return diferenca.gt(0) && ComAditivo.safeParse(snapshot).success ? "REDUCAO_ADITIVO" : "DESCONTO";
}

export function diferencaValorCompra(snapshot: unknown, diferenca: Prisma.Decimal) {
  const origem = origemDiferencaCompra(snapshot, diferenca);
  return { origem, valor: diferenca.toFixed(2), rotulo: ROTULO_DIFERENCA_COMPRA[origem] };
}
