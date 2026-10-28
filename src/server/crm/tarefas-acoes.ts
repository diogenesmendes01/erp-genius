"use server";

import type { Resultado } from "@/server/_shared/resultado";
import type { DecisaoMensagemAgendada } from "@/lib/selo-mensagem-agendada";
import { reagendarMensagem as reagendarMensagemDominio } from "./mensagens-agendadas";
import { marcarNotificacaoLida as marcarNotificacaoLidaDominio } from "./notificacoes";
import {
  assumirTarefa as assumirTarefaDominio,
  cancelarTarefa as cancelarTarefaDominio,
  concluirTarefa as concluirTarefaDominio,
  criarTarefa as criarTarefaDominio,
  editarTarefa as editarTarefaDominio,
  reabrirTarefa as reabrirTarefaDominio,
  reagendarTarefa as reagendarTarefaDominio,
  type TarefaInput,
} from "./tarefas";

export async function criarTarefa(i: TarefaInput): Promise<Resultado<{ id: string }>> {
  return criarTarefaDominio(i);
}
export async function editarTarefa(id: string, versao: number, i: Partial<TarefaInput>): Promise<Resultado> {
  return editarTarefaDominio(id, versao, i);
}
export async function concluirTarefa(id: string, versao: number, resultado?: string, mensagemAgendada?: DecisaoMensagemAgendada): Promise<Resultado> {
  return concluirTarefaDominio(id, versao, resultado, mensagemAgendada);
}
export async function reabrirTarefa(id: string, versao: number): Promise<Resultado> {
  return reabrirTarefaDominio(id, versao);
}
export async function reagendarTarefa(id: string, versao: number, q: { dataCivil: string | null; hora: string | null }): Promise<Resultado> {
  return reagendarTarefaDominio(id, versao, q);
}
export async function cancelarTarefa(id: string, versao: number, motivo: string, mensagemAgendada?: DecisaoMensagemAgendada): Promise<Resultado> {
  return cancelarTarefaDominio(id, versao, motivo, mensagemAgendada);
}
export async function assumirTarefa(id: string): Promise<Resultado> {
  return assumirTarefaDominio(id);
}
export async function reagendarMensagem(id: string, agendadaPara: string): Promise<Resultado> {
  return reagendarMensagemDominio(id, agendadaPara);
}
export async function marcarNotificacaoLida(id: string): Promise<Resultado> {
  return marcarNotificacaoLidaDominio(id);
}
