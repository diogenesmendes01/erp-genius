import type { Prisma } from "@prisma/client";

/**
 * Parcelas da diferença entre o valor original gravado na compra e o valor pago (`descontoOriginal`).
 * Q172: `valorOriginal` é o preço de referência × minutos da emissão, que a aplicação do aditivo não altera;
 * a aplicação só move `valorNegociado`. Por isso a diferença pode somar desconto de emissão (referência acima
 * do negociado) e redução contratual por aditivo. Só a queda do valor negociado entre a 1ª aplicação
 * (`valorAnterior`) e a última (`valorNovo`) é redução; o restante continua desconto original.
 * Sem dependência de execução do Prisma: o tipo e os rótulos também servem às telas.
 */
export type DiferencaValorCompra = { valor: string; desconto: string; reducaoAditivo: string };

export const ROTULO_DESCONTO_COMPRA = "Desconto original";
export const ROTULO_REDUCAO_COMPRA = "Redução do adiantamento por aditivo";
export const ROTULO_DESCONTO_CREDITO = "Desconto original já considerado";
export const ROTULO_REDUCAO_CREDITO = "Redução do adiantamento por aditivo já considerada";

type AplicacaoValor = { valorAnterior: Prisma.Decimal; valorNovo: Prisma.Decimal };

/** `aplicacoes` na ordem em que foram aplicadas à cobrança, até a registrada na memória da compra. */
export function separarDiferencaCompra(descontoOriginal: Prisma.Decimal, aplicacoes: readonly AplicacaoValor[]): DiferencaValorCompra {
  const zero = descontoOriginal.minus(descontoOriginal);
  let reducao = zero;
  if (aplicacoes.length && descontoOriginal.gt(0)) {
    const queda = aplicacoes[0].valorAnterior.minus(aplicacoes[aplicacoes.length - 1].valorNovo);
    reducao = queda.lte(0) ? zero : queda.gt(descontoOriginal) ? descontoOriginal : queda;
  }
  return { valor: descontoOriginal.toFixed(2), desconto: descontoOriginal.minus(reducao).toFixed(2), reducaoAditivo: reducao.toFixed(2) };
}

/** Linhas a exibir: cada parcela positiva; sem nenhuma, o desconto original (zero) como antes da Q172. */
export function parcelasDiferenca(d: Pick<DiferencaValorCompra, "desconto" | "reducaoAditivo">) {
  const reducao = Number(d.reducaoAditivo) > 0;
  return { desconto: Number(d.desconto) > 0 || !reducao, reducao };
}
