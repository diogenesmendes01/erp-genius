"use client";

import { useSyncExternalStore } from "react";
import type { VistaInbox } from "./InboxNovo";

// Limiares locais: a Sidebar global ocupa 224px a partir de md. Validados pela medição da casca.
export const LIMIAR_DUAS_COLUNAS = 960;
export const LIMIAR_TRES_COLUNAS = 1400;
const CONSULTAS = ["(min-width: 960px)", "(min-width: 1400px)"];
export type ModoInbox = "uma" | "duas" | "tres";
function lerModo(): ModoInbox {
  return window.matchMedia(CONSULTAS[1]).matches ? "tres" : window.matchMedia(CONSULTAS[0]).matches ? "duas" : "uma";
}
function assinarModo(avisar: () => void) {
  const medias = CONSULTAS.map((consulta) => window.matchMedia(consulta));
  medias.forEach((media) => media.addEventListener("change", avisar));
  return () => medias.forEach((media) => media.removeEventListener("change", avisar));
}
const modoServidor = () => null;
/** CSS decide o primeiro paint; o snapshot neutro é igual no servidor e na hidratação. */
export function useModoInbox(): ModoInbox | null { return useSyncExternalStore(assinarModo, lerModo, modoServidor); }

export function painelEfetivo(aberto: boolean | null, vista: VistaInbox, largura: number): boolean {
  return largura < LIMIAR_DUAS_COLUNAS ? vista === "painel" : aberto ?? largura >= LIMIAR_TRES_COLUNAS;
}
export function proximoEstadoPainel(aberto: boolean | null, largura: number): { aberto: boolean | null; vista?: VistaInbox } {
  return largura < LIMIAR_DUAS_COLUNAS ? { aberto, vista: "painel" } : { aberto: !painelEfetivo(aberto, "conversa", largura) };
}
export function classesDoPainel(aberto: boolean | null, vista: VistaInbox): string {
  const base = `relative ${vista === "painel" ? "flex" : "hidden"} w-full min-[960px]:w-[348px] shrink-0 min-h-0 flex-col overflow-hidden border-gray-200 bg-surface min-[960px]:border-l`;
  if (aberto === false) return `${base} min-[960px]:hidden`;
  if (aberto === null) return `${base} min-[960px]:hidden min-[1400px]:flex`;
  return `${base} min-[960px]:flex min-[960px]:max-[1399px]:absolute min-[960px]:max-[1399px]:inset-y-0 min-[960px]:max-[1399px]:right-0 min-[960px]:max-[1399px]:z-30 min-[960px]:max-[1399px]:shadow-dialog`;
}
