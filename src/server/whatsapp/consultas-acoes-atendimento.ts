"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/server/_shared";
import { podeExecutar } from "@/server/inbox/permissoes";
import { atendimentoVisivel } from "./atendimentos";
import { PAPEIS_INBOX } from "./escopo";
import { ehGerenteDoSetor, papeisDoSetor, type Setor } from "./setor";
import { Papel } from "@prisma/client";

const IdSchema = z.string().min(1);

/**
 * Pessoas para os diálogos do cabeçalho (Task 31). `atribuir`: quem atende o setor do atendimento; `convidar`: qualquer
 * pessoa ativa do Inbox. Só nome e id, só para quem tem a alçada da ação sobre um atendimento que enxerga; senão, vazio.
 */
export async function listarPessoasParaAtendimento(atendimentoId: string, para: "atribuir" | "convidar"): Promise<{ id: string; nome: string }[]> {
  const u = await exigirSessao();
  const id = IdSchema.parse(atendimentoId);
  const a = await atendimentoVisivel(u, id);
  if (!a || a.encerradoEm) return [];
  if (!podeExecutar(u, para, { setor: a.finalidade, responsavelId: a.responsavelId })) return [];
  const papeis = para === "atribuir" ? papeisDoSetor(a.finalidade) : PAPEIS_INBOX;
  return prisma.usuario.findMany({
    where: { ativo: true, id: { not: u.id }, papeis: { hasSome: papeis } },
    select: { id: true, nome: true }, orderBy: { nome: "asc" }, take: 200,
  });
}

/** Setor do atendimento de origem de uma transferência, só se o usuário também o enxerga (escopo); senão null. */
export async function origemVisivelDaTransferencia(origemId: string): Promise<{ setor: Setor } | null> {
  const u = await exigirSessao();
  const o = await atendimentoVisivel(u, IdSchema.parse(origemId));
  return o ? { setor: o.finalidade } : null;
}

export interface ConviteAtivo { id: string; nome: string; fim: string; podeEnviar: boolean }
export interface AgendamentoAtivo { id: string; texto: string; agendadaPara: string }

/**
 * Convites ativos e mensagens agendadas pendentes do atendimento, só o que a pessoa pode desfazer (Task 31):
 * convite — concedente, gerente do setor ou administrador (a mesma regra de `revogarParticipante`); agendamento —
 * o autor ou o administrador (a mesma de `cancelarMensagemAgendada`). Sem acesso ao atendimento, listas vazias.
 */
export async function listarConvitesEAgendamentos(atendimentoId: string): Promise<{ convites: ConviteAtivo[]; agendamentos: AgendamentoAtivo[] }> {
  const u = await exigirSessao();
  const id = IdSchema.parse(atendimentoId);
  const a = await atendimentoVisivel(u, id);
  if (!a || a.encerradoEm) return { convites: [], agendamentos: [] };
  const agora = new Date();
  const admin = u.papeis.includes(Papel.ADMINISTRADOR);
  const gerente = ehGerenteDoSetor(u.papeis, a.finalidade);
  const [convites, agendadas] = await Promise.all([
    prisma.participanteAtendimentoWhatsApp.findMany({
      where: { atendimentoId: id, revogadoEm: null, fim: { gt: agora }, ...(admin || gerente ? {} : { concedenteId: u.id }) },
      select: { id: true, fim: true, podeEnviar: true, usuario: { select: { nome: true } } }, orderBy: { fim: "asc" }, take: 50,
    }),
    prisma.intencaoMensagem.findMany({
      where: { atendimentoId: id, origem: "HUMANO", agendadaPara: { not: null }, passo: null, passoComercial: null, status: { in: ["PENDENTE", "ADIADA"] }, ...(admin ? {} : { autorId: u.id }) },
      select: { id: true, corpoRenderizado: true, agendadaPara: true }, orderBy: { agendadaPara: "asc" }, take: 50,
    }),
  ]);
  return {
    convites: convites.map((c) => ({ id: c.id, nome: c.usuario.nome, fim: c.fim.toISOString(), podeEnviar: c.podeEnviar })),
    agendamentos: agendadas.map((m) => ({ id: m.id, texto: m.corpoRenderizado, agendadaPara: m.agendadaPara!.toISOString() })),
  };
}
