import { ErroRegra } from "@/server/_shared";
export type FonteContinuidade = "ADITIVO" | "RECOMPOSICAO" | "RETOMADA";
export function selecionarFonteContinuidade(fontes: readonly { tipo: FonteContinuidade; aplicadaEm: string }[]) {
  const ordenadas = [...fontes].sort((a, b) => b.aplicadaEm.localeCompare(a.aplicadaEm));
  if (ordenadas.length > 1 && ordenadas[0].aplicadaEm === ordenadas[1].aplicadaEm) throw new ErroRegra("Há origens de cobertura aplicadas no mesmo instante; confira a precedência antes de planejar.");
  return ordenadas[0]?.tipo ?? null;
}