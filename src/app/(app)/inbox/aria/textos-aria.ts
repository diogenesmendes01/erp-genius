import type { MotivoPausaAtendimentoIA } from "@prisma/client";
import { MOTIVO_PAUSA_IA_LABEL } from "@/lib/labels";
import type { EstadoAria } from "@/server/inbox/estado-aria-valores";
import type { TomEstado } from "../estado-visual";

export function textoPausaAria(motivo: MotivoPausaAtendimentoIA | null): string {
  return motivo ? `Aria pausada · ${MOTIVO_PAUSA_IA_LABEL[motivo]}` : "Aria pausada";
}
export type LinhaEstadoAria = { tom: TomEstado; texto: string; dica: string | null };
export function linhaEstadoAria(estado: EstadoAria | null, o: { atendidoPorVoce: boolean; responsavelNome: string | null; podeDecidir: boolean; pausada: boolean; motivo: MotivoPausaAtendimentoIA | null }): LinhaEstadoAria | null {
  if (!estado) return null;
  const nome = o.responsavelNome?.trim().split(/\s+/)[0];
  const texto = estado === "ia" ? "Aria está atendendo" : estado === "aprovacao" ? (o.podeDecidir ? "Aria aguarda sua aprovação" : "Aria aguarda aprovação") : estado === "handoff" ? "Aria pediu um humano" : o.atendidoPorVoce ? "Você está atendendo" : nome ? `${nome} está atendendo` : "Uma pessoa está atendendo";
  return { tom: estado, texto, dica: o.pausada ? textoPausaAria(o.motivo) : null };
}
export function haQuanto(iso: string, agora: Date): string {
  const diferenca = agora.getTime() - new Date(iso).getTime();
  if (!Number.isFinite(diferenca)) return "";
  const minutos = Math.floor(Math.max(0, diferenca) / 60_000);
  if (!minutos) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
}
