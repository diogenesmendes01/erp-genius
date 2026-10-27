import { hrefLista, lerOpcao, type ParametrosUrl } from "@/lib/pagina-url";
import type { CursorDoLink } from "@/components/PaginacaoFila";

export const ROTA_FILA_ENVIOS = "/secretaria/envios-portal";

export const SITUACOES_FILA_ENVIOS = ["incertos", "falhas", "todos"] as const;
export type SituacaoFilaEnvios = (typeof SITUACOES_FILA_ENVIOS)[number];

export const SITUACAO_FILA_ENVIOS_PADRAO: SituacaoFilaEnvios = "incertos";

export const ROTULO_SITUACAO_FILA_ENVIOS: Readonly<Record<SituacaoFilaEnvios, string>> = {
  incertos: "Incertos",
  falhas: "Falhas",
  todos: "Todos",
};

export function lerSituacaoFilaEnvios(p: ParametrosUrl): SituacaoFilaEnvios {
  return lerOpcao(p, "situacao", SITUACOES_FILA_ENVIOS) ?? SITUACAO_FILA_ENVIOS_PADRAO;
}

export function whereSituacaoFilaEnvios(s: SituacaoFilaEnvios): { situacao?: "INCERTO" | "FALHOU" } {
  if (s === "incertos") return { situacao: "INCERTO" };
  if (s === "falhas") return { situacao: "FALHOU" };
  return {};
}

export function hrefFilaEnvios(s: SituacaoFilaEnvios, cursor?: CursorDoLink): string {
  return hrefLista(ROTA_FILA_ENVIOS, { situacao: s === SITUACAO_FILA_ENVIOS_PADRAO ? null : s, ...(cursor ?? {}) });
}
