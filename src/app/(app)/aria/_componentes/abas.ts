import { ABAS_ARIA, type AbaAria } from "@/server/aria/tela";

export { ABAS_ARIA };
export type { AbaAria };

export const ROTULO_ABA: Record<AbaAria, string> = {
  visao: "Visão geral",
  comportamento: "Comportamento",
  permissoes: "Permissões",
  conhecimento: "Conhecimento",
  handoff: "Handoff",
  confianca: "Confiança",
  historico: "Histórico",
};

/** Abas que editam a configuração: só no computador (no celular ficam pausa, visão geral e histórico). */
export const ABAS_DE_EDICAO: readonly AbaAria[] = ["comportamento", "permissoes", "conhecimento", "handoff", "confianca"];
