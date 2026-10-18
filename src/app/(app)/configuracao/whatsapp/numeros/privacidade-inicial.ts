import type { PrivacidadeNumero } from "@/server/whatsapp/motor/numero";

export const PRIV_PADRAO = { vistoPorUltimo: "CONTATOS", foto: "CONTATOS", recado: "CONTATOS", grupos: "CONTATOS" } as const satisfies PrivacidadeNumero;

/** Estado inicial do painel: a privacidade gravada pode ser parcial (motor aplicou só parte), então completa com o padrão. */
export function privacidadeInicial(gravada: Partial<PrivacidadeNumero> | null | undefined): PrivacidadeNumero {
  return { ...PRIV_PADRAO, ...(gravada ?? {}) };
}
