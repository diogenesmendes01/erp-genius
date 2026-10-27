import type { Prisma } from "@prisma/client";

export type DiferencaValorCompra = { valor: string; desconto: string; reducaoAditivo: string };

export const ROTULO_DESCONTO_COMPRA = "Desconto original";
export const ROTULO_REDUCAO_COMPRA = "Redução do adiantamento por aditivo";
export const ROTULO_DESCONTO_CREDITO = "Desconto original já considerado";
export const ROTULO_REDUCAO_CREDITO = "Redução do adiantamento por aditivo já considerada";

type AplicacaoValor = { valorAnterior: Prisma.Decimal; valorNovo: Prisma.Decimal };

export function separarDiferencaCompra(descontoOriginal: Prisma.Decimal, aplicacoes: readonly AplicacaoValor[]): DiferencaValorCompra {
  const zero = descontoOriginal.minus(descontoOriginal);
  let reducao = zero;
  if (aplicacoes.length && descontoOriginal.gt(0)) {
    const queda = aplicacoes[0].valorAnterior.minus(aplicacoes[aplicacoes.length - 1].valorNovo);
    reducao = queda.lte(0) ? zero : queda.gt(descontoOriginal) ? descontoOriginal : queda;
  }
  return { valor: descontoOriginal.toFixed(2), desconto: descontoOriginal.minus(reducao).toFixed(2), reducaoAditivo: reducao.toFixed(2) };
}

export function parcelasDiferenca(d: Pick<DiferencaValorCompra, "desconto" | "reducaoAditivo">) {
  const reducao = Number(d.reducaoAditivo) > 0;
  return { desconto: Number(d.desconto) > 0 || !reducao, reducao };
}
