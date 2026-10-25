"use client";
import type { ReactNode } from "react";
import { IconMail, IconPin, IconBellOff, IconBell, IconNote, IconClock, IconCalendarEvent, IconSearch, IconUserCheck, IconArrowBackUp, IconUserPlus, IconDoorExit, IconBan, IconDotsVertical, IconListCheck } from "@tabler/icons-react";
import { Menu } from "@/components/Menu";
import { AVISO_RECURSO_MOTOR } from "@/components/conversa/recursos-canal";
import type { AcaoInbox } from "@/server/inbox/permissoes";

export type ItemMenuConversa = { id: string; rotulo: string; icone: ReactNode; dica?: string; perigo?: boolean; desabilitado?: boolean; divisorDepois?: boolean; aoEscolher(): void };
export type AcaoConversa = { rotulo: string; aoEscolher(): void; ocupado?: boolean };
export type AcoesCabecalho = { assumir: AcaoConversa | null; transferir: AcaoConversa | null; menu: ItemMenuConversa[]; dialogos: ReactNode; feedback: ReactNode; abrirAgendar: (() => void) | null };

/** Capacidades do ERP: não são IDs visuais do menu (notaInterna, convidar/agendar). */
export function itensDoMenuConversa(o: { pode(a: AcaoInbox): boolean; fixada: boolean; silenciada: boolean; acoes: Record<string, () => void> }): ItemMenuConversa[] {
 const item = (id: string, rotulo: string, Icone: typeof IconMail, extra: Partial<ItemMenuConversa> = {}): ItemMenuConversa => ({ id, rotulo, icone: <Icone size={16} />, aoEscolher: o.acoes[id], ...extra });
 return [
  item("naoLida", "Marcar como não lida", IconMail),
  item("fixar", o.fixada ? "Desafixar conversa" : "Fixar conversa", IconPin, { dica: "só você" }),
  item("silenciar", o.silenciada ? "Reativar notificações" : "Silenciar", o.silenciada ? IconBell : IconBellOff, { dica: "8 h · só você", divisorDepois: true }),
  ...(o.pode("notaInterna") ? [item("nota", "Nota interna", IconNote)] : []),
  ...(typeof o.acoes.criarTarefa === "function" ? [item("criar-tarefa", "Criar tarefa", IconListCheck, { aoEscolher: o.acoes.criarTarefa })] : []),
  ...(o.pode("agendar") ? [item("agendar", "Agendar mensagem", IconClock)] : []),
  ...(o.pode("convidar") || o.pode("agendar") ? [item("pendentes", "Convites e agendamentos", IconCalendarEvent)] : []),
  item("buscar", "Buscar na conversa", IconSearch, { divisorDepois: true }),
  ...(o.pode("atribuir") ? [item("atribuir", "Atribuir", IconUserCheck)] : []),
  ...(o.pode("devolver") ? [item("devolver", "Devolver para a fila", IconArrowBackUp)] : []),
  ...(o.pode("convidar") ? [item("convidar", "Convidar", IconUserPlus, { divisorDepois: true })] : []),
  ...(o.pode("encerrar") ? [item("encerrar", "Encerrar atendimento", IconDoorExit)] : []),
  ...(o.pode("bloquear") ? [item("bloquear", "Bloquear contato", IconBan, { perigo: true, desabilitado: true, dica: AVISO_RECURSO_MOTOR })] : []),
 ];
}
export function MenuConversa({ itens }: { itens: ItemMenuConversa[] }) {
 return <Menu rotulo="Mais ações da conversa" gatilho={<IconDotsVertical size={17} />} itens={itens} densidade="compacta" folhaNoCelular classeGatilho="h-9 w-9 shrink-0 rounded-full text-gray-600 aria-expanded:bg-gray-100" />;
}
