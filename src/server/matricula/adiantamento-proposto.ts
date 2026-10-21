import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared/sessao";

/** Valor proposto pelos minutos contratados, preservando a fração de hora (Q94). */
export function calcularAdiantamentoProposto(regime: string, minutos: number | undefined, valorHora: string, exigido: boolean | null) {
  if (regime !== "HORA_PARTICULAR") {
    if (minutos !== undefined) throw new ErroRegra("Adiantamento de horas não se aplica à mensalidade fixa.");
    return null;
  }
  if (minutos === undefined) {
    if (exigido === true) throw new ErroRegra("Informe os minutos contratados para o adiantamento inicial exigido pela oferta.");
    return null;
  }
  if (!Number.isSafeInteger(minutos) || minutos <= 0) throw new ErroRegra("Informe uma quantidade inteira e positiva de minutos.");
  const valor = new Prisma.Decimal(valorHora).mul(minutos).div(60).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (valor.lessThanOrEqualTo(0) || valor.greaterThan("9999999999.99")) throw new ErroRegra("O adiantamento precisa ter valor positivo dentro do limite monetário.");
  return { minutos, unidadeMinutos: 60, valorHora, valor: valor.toFixed(2), arredondamento: "MONETARIO_2_CASAS_HALF_UP" };
}
