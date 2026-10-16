import { hrefLista, lerOpcao, type ParametrosUrl } from "@/lib/pagina-url";
import type { CursorDoLink } from "@/components/PaginacaoFila";

// Filtro de situação da fila de envios de acesso ao portal (docs/42 L431; docs/43 §6 item 9). A tela existe
// para tratar "Resultado incerto", mas listava todas as situações em ordem de id: achar os incertos era varrer
// todas as páginas. Abas "Incertos", "Falhas" e "Todos" no cabeçalho, com "Incertos" como padrão da tela; a
// escolha vai na URL (`?situacao=`) e é mantida na navegação por cursor. Módulo puro (o arquivo da consulta é
// "use server" e só exporta funções assíncronas).

export const ROTA_FILA_ENVIOS = "/secretaria/envios-portal";

/** Recortes da fila, na ordem das abas (valor da URL). */
export const SITUACOES_FILA_ENVIOS = ["incertos", "falhas", "todos"] as const;
export type SituacaoFilaEnvios = (typeof SITUACOES_FILA_ENVIOS)[number];

/** O recorte que a tela abre: o que ela existe para tratar. */
export const SITUACAO_FILA_ENVIOS_PADRAO: SituacaoFilaEnvios = "incertos";

/** Rótulo de cada aba. */
export const ROTULO_SITUACAO_FILA_ENVIOS: Readonly<Record<SituacaoFilaEnvios, string>> = {
  incertos: "Incertos",
  falhas: "Falhas",
  todos: "Todos",
};

/** Recorte da URL; ausente ou desconhecido vira o padrão da tela. */
export function lerSituacaoFilaEnvios(p: ParametrosUrl): SituacaoFilaEnvios {
  return lerOpcao(p, "situacao", SITUACOES_FILA_ENVIOS) ?? SITUACAO_FILA_ENVIOS_PADRAO;
}

/** Condição do recorte na consulta (a situação da solicitação); "todos" não filtra. */
export function whereSituacaoFilaEnvios(s: SituacaoFilaEnvios): { situacao?: "INCERTO" | "FALHOU" } {
  if (s === "incertos") return { situacao: "INCERTO" };
  if (s === "falhas") return { situacao: "FALHOU" };
  return {};
}

/** Link da fila no recorte (o padrão fica fora da URL) e, se houver, no cursor. */
export function hrefFilaEnvios(s: SituacaoFilaEnvios, cursor?: CursorDoLink): string {
  return hrefLista(ROTA_FILA_ENVIOS, { situacao: s === SITUACAO_FILA_ENVIOS_PADRAO ? null : s, ...(cursor ?? {}) });
}
