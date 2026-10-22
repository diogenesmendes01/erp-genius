import { iniciais, tomDoAvatar } from "@/components/Avatar";
import { SETOR_ATENDIMENTO_LABEL, STATUS_ATENDIMENTO_LABEL, rotular } from "@/lib/labels";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import { prazoEstourado } from "./prazo-vivo";

export type TomEstado = "ia" | "aprovacao" | "handoff" | "humano" | "sem-resposta" | "atraso" | "neutro";
export type BadgeVisual = { tom: TomEstado; texto: string; ponto?: boolean; tracejado?: boolean; icone?: "relogio" | "sem-nome" };
export const CLASSES_TOM: Record<TomEstado, string> = {
  ia: "bg-ai-50 text-ai-700", aprovacao: "bg-amber-50 text-amber-700", handoff: "bg-red-50 text-red-700",
  humano: "bg-brand-bg text-brand-700", "sem-resposta": "bg-amber-50 text-amber-700", atraso: "bg-red-50 text-red-700", neutro: "bg-surface-muted text-gray-600",
};
export const PONTO_TOM: Record<TomEstado, string> = {
  ia: "bg-ai-700", aprovacao: "bg-amber-600", handoff: "bg-red-600", humano: "bg-brand-solid", "sem-resposta": "bg-amber-600", atraso: "bg-red-600", neutro: "bg-gray-400",
};
export const TEXTO_TOM: Record<TomEstado, string> = {
  ia: "text-ai-700", aprovacao: "text-amber-700", handoff: "text-red-700", humano: "text-brand-700", "sem-resposta": "text-amber-700", atraso: "text-red-700", neutro: "text-gray-600",
};

export function tempoDeEspera(min: number): string {
  const minutos = Math.max(1, Math.floor(min));
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return horas ? horas + " h" + (resto ? " " + resto + " min" : "") : minutos + " min";
}
const primeiroNome = (nome: string | null) => nome?.trim().split(/\s+/)[0] || "Responsável";

export function estadoVisualItem(item: ItemListaInbox, agora: Date, usuarioId?: string): { badges: BadgeVisual[]; previa: string; avatarTom: number; seloIa: boolean } {
  const badges: BadgeVisual[] = [];
  if (!item.grupo) {
    if (item.status === "ENCERRADO") badges.push({ tom: "neutro", texto: "Encerrado" });
    else if (item.responsavelId) badges.push({ tom: "humano", texto: item.responsavelId === usuarioId ? "Com você" : "Com " + primeiroNome(item.responsavelNome) });
    badges.push({ tom: "neutro", texto: rotular(SETOR_ATENDIMENTO_LABEL, item.finalidade), ponto: false });
    if (prazoEstourado(item, agora.getTime())) {
      const min = Math.max(1, Math.floor((agora.getTime() - new Date(item.prazoRespostaEm!).getTime()) / 60_000));
      badges.push({ tom: min >= 30 ? "atraso" : "sem-resposta", texto: "Prazo estourado · " + tempoDeEspera(min), icone: "relogio", ponto: false });
    }
    if (!iniciais(item.contatoNome)) badges.push({ tom: "neutro", texto: "Sem nome", tracejado: true, icone: "sem-nome", ponto: false });
    if (item.status !== "ENCERRADO" && !item.responsavelId) badges.push({ tom: "neutro", texto: "Na fila", tracejado: true, ponto: false });
  }
  return { badges, previa: item.preview ?? "", avatarTom: tomDoAvatar(item.contatoId), seloIa: false };
}

export function estadoVisualCabecalho(item: ItemListaInbox, usuarioId: string): { status: string; estado: { tom: TomEstado; texto: string }; subtitulo: string } {
  const estado: { tom: TomEstado; texto: string } = item.grupo ? { tom: "neutro", texto: "Conversa em grupo" }
    : item.status === "ENCERRADO" ? { tom: "neutro", texto: "Atendimento encerrado" }
    : !item.responsavelId ? { tom: "neutro", texto: "Sem responsável" }
    : { tom: "humano", texto: item.responsavelId === usuarioId ? "Você está atendendo" : primeiroNome(item.responsavelNome) + " está atendendo" };
  return { status: item.grupo ? "Grupo" : rotular(STATUS_ATENDIMENTO_LABEL, item.status), estado, subtitulo: rotular(SETOR_ATENDIMENTO_LABEL, item.finalidade) + " · " + item.numeroRotulo };
}
