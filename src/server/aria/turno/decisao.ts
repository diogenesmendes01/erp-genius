import type { ConfigAria, ModoAcao } from "../config-schema";

export type DestinoAcao = "EXECUTAR" | "SUGERIR" | "NEGAR";

/** Decide o que fazer com uma ação proposta: a matriz manda, a confiança e a supervisão rebaixam. */
export function destinoDaAcao(i: {
  modo: ModoAcao | "SEMPRE";
  confianca: number;
  config: ConfigAria;
  supervisao: boolean;
  soSugerir: boolean;
}): DestinoAcao {
  if (i.modo === "SEMPRE") return "EXECUTAR";
  if (i.modo === "NAO_FAZ") return "NEGAR";
  if (i.modo === "SUGERE") return "SUGERIR";
  if (i.supervisao || i.soSugerir) return "SUGERIR";
  return i.confianca >= i.config.confianca.executaAPartirDe ? "EXECUTAR" : "SUGERIR";
}
