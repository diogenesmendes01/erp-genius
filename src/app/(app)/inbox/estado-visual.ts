import { iniciais, tomDoAvatar } from "@/components/Avatar";
import type { TomEstado } from "@/components/BadgeEstado";
import { SETOR_ATENDIMENTO_LABEL, STATUS_ATENDIMENTO_LABEL, rotular } from "@/lib/labels";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import { prazoEstourado } from "./prazo-atendimento";

export { CLASSES_TOM, PONTO_TOM, TEXTO_TOM } from "@/components/BadgeEstado";
export type { TomEstado } from "@/components/BadgeEstado";

export type BadgeVisual = { tom: TomEstado; texto: string; ponto?: boolean; tracejado?: boolean; icone?: "relogio" | "sem-nome" };

export function tempoDeEspera(min: number): string {
  const minutos = Math.max(1, Math.floor(min));
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return horas ? horas + " h" + (resto ? " " + resto + " min" : "") : minutos + " min";
}
const primeiroNome = (nome: string | null) => nome?.trim().split(/\s+/)[0] || "Responsável";

export function estadoVisualItem(item: ItemListaInbox, agora: Date, usuarioId?: string): { badges: BadgeVisual[]; previa: string; avatarTom: number; seloIa: boolean } {
  const badges: BadgeVisual[] = [];
  const estado = item.grupo ? null : item.estadoAria;
  if (!item.grupo) {
    if (estado === "ia") badges.push({ tom: "ia", texto: "IA atendendo" });
    else if (estado === "aprovacao") badges.push({ tom: "aprovacao", texto: "Aguardando aprovação" });
    else if (estado === "handoff") badges.push({ tom: "handoff", texto: "Handoff pendente" });
    else if (estado === "humano") badges.push({ tom: "humano", texto: item.atendidoPorVoce ? "Com você" : item.responsavelNome?.trim() ? "Com " + primeiroNome(item.responsavelNome) : "Humano" });
    else if (item.status === "ENCERRADO") badges.push({ tom: "neutro", texto: "Encerrado" });
    else if (item.responsavelId) badges.push({ tom: "humano", texto: item.responsavelId === usuarioId ? "Com você" : "Com " + primeiroNome(item.responsavelNome) });
    badges.push({ tom: "neutro", texto: rotular(SETOR_ATENDIMENTO_LABEL, item.finalidade), ponto: false });
    if (prazoEstourado(item, agora.getTime())) {
      const min = Math.max(1, Math.floor((agora.getTime() - new Date(item.prazoRespostaEm!).getTime()) / 60_000));
      badges.push({ tom: min >= 30 ? "atraso" : "sem-resposta", texto: "Prazo estourado · " + tempoDeEspera(min), icone: "relogio", ponto: false });
    }
    if (!iniciais(item.contatoNome)) badges.push({ tom: "neutro", texto: "Sem nome", tracejado: true, icone: "sem-nome", ponto: false });
    if (item.status !== "ENCERRADO" && !item.responsavelId) badges.push({ tom: "neutro", texto: "Na fila", tracejado: true, ponto: false });
  }
  const preview = item.preview ?? "";
  const rotuloPrevia = item.previaRotulo?.trim();
  const previa = item.previaAutor === "sugestao" ? rotuloPrevia ? "Aria sugere: " + rotuloPrevia : "Sugestão da Aria"
    : item.previaAutor === "aria" ? "Aria: " + preview
    : item.previaAutor === "voce" ? "Você: " + preview
    : item.previaAutor === "pessoa" ? (rotuloPrevia || "Equipe") + ": " + preview : preview;
  return { badges, previa, avatarTom: tomDoAvatar(item.contatoId), seloIa: estado === "ia" || estado === "aprovacao" || estado === "handoff" };
}

export type ItemEstadoCabecalho = Pick<ItemListaInbox, "grupo" | "status" | "responsavelId" | "responsavelNome" | "finalidade" | "numeroRotulo">;

export function estadoVisualCabecalho(item: ItemEstadoCabecalho, usuarioId: string): { status: string; estado: { tom: TomEstado; texto: string }; subtitulo: string } {
  const estado: { tom: TomEstado; texto: string } = item.grupo ? { tom: "neutro", texto: "Conversa em grupo" }
    : item.status === "ENCERRADO" ? { tom: "neutro", texto: "Atendimento encerrado" }
    : !item.responsavelId ? { tom: "neutro", texto: "Sem responsável" }
    : { tom: "humano", texto: item.responsavelId === usuarioId ? "Você está atendendo" : primeiroNome(item.responsavelNome) + " está atendendo" };
  return { status: item.grupo ? "Grupo" : rotular(STATUS_ATENDIMENTO_LABEL, item.status), estado, subtitulo: rotular(SETOR_ATENDIMENTO_LABEL, item.finalidade) + " · " + item.numeroRotulo };
}
