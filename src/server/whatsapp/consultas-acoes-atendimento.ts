"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/server/_shared";
import { podeExecutar } from "@/server/inbox/permissoes";
import { atendimentoVisivel } from "./atendimentos";
import { PAPEIS_INBOX } from "./escopo";
import { papeisDoSetor, type Setor } from "./setor";

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
