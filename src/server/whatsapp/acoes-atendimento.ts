"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessao, registrarEvento, type Resultado } from "@/server/_shared";
import { podeExecutar } from "@/server/inbox/permissoes";
import { atendimentoVisivel } from "./atendimentos";
import { papeisDoSetor } from "./setor";
import { proximoStatus } from "./status-atendimento";

const MSG_JA_ASSUMIDO = "Outro atendente já assumiu este atendimento.";
const MSG_FORA_DO_ESCOPO = "Atendimento fora do seu escopo.";
const MSG_SEM_ALCADA = "Sua função não autoriza esta ação neste atendimento.";
const MOTIVO_CANCELAMENTO = "Responsável do atendimento mudou; revisar antes de enviar.";

const IdSchema = z.string().min(1);
const AtribuirSchema = z.object({ atendimentoId: z.string().min(1), usuarioId: z.string().min(1) });

/** Tira o atendimento de quem o tinha: intenções humanas ainda não enviadas deixam de valer (como comercial/acoes.ts, atribuirDono). */
async function cancelarIntencoesDoResponsavel(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], atendimentoId: string, responsavelId: string | null) {
  if (!responsavelId) return;
  await tx.intencaoMensagem.updateMany({
    where: { atendimentoId, origem: "HUMANO", autorId: responsavelId, status: { in: ["PENDENTE", "ADIADA"] } },
    data: { status: "CANCELADA", motivoFalha: MOTIVO_CANCELAMENTO },
  });
}

/** Assume da fila: só vence quem encontra o atendimento aberto e sem responsável (UPDATE condicional). */
export async function assumirAtendimento(atendimentoId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const id = IdSchema.parse(atendimentoId);
    const a = await atendimentoVisivel(u, id);
    if (!a) throw new ErroRegra(MSG_FORA_DO_ESCOPO);
    if (a.encerradoEm) throw new ErroRegra("Atendimento encerrado.");
    if (a.responsavelId !== null) throw new ErroRegra(MSG_JA_ASSUMIDO);
    if (!podeExecutar(u, "assumir", { setor: a.finalidade, responsavelId: a.responsavelId })) throw new ErroRegra(MSG_SEM_ALCADA);
    await prisma.$transaction(async (tx) => {
      const status = proximoStatus(a.status, "ASSUMIDO", true);
      const r = await tx.atendimentoWhatsApp.updateMany({ where: { id, responsavelId: null, encerradoEm: null }, data: { responsavelId: u.id, status } });
      if (r.count !== 1) throw new ErroRegra(MSG_JA_ASSUMIDO);
      await registrarEvento(tx, { tipo: "AtendimentoAssumido", agregadoTipo: "AtendimentoWhatsApp", agregadoId: id, autorId: u.id, payload: { de: null, para: u.id } });
    });
    revalidatePath("/inbox");
  });
}

/** Devolve à fila: zera o responsável, volta a ABERTO_SEM_RESPONSAVEL e cancela as intenções humanas pendentes dele. */
export async function devolverParaFila(atendimentoId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const id = IdSchema.parse(atendimentoId);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id = ${id} FOR UPDATE`;
      const a = await atendimentoVisivel(u, id);
      if (!a) throw new ErroRegra(MSG_FORA_DO_ESCOPO);
      if (a.encerradoEm) throw new ErroRegra("Atendimento encerrado.");
      if (a.responsavelId === null) throw new ErroRegra("Este atendimento já está na fila.");
      if (!podeExecutar(u, "devolver", { setor: a.finalidade, responsavelId: a.responsavelId })) throw new ErroRegra(MSG_SEM_ALCADA);
      const atual = await tx.atendimentoWhatsApp.findUniqueOrThrow({ where: { id }, select: { status: true, responsavelId: true } });
      const anterior = atual.responsavelId;
      await tx.atendimentoWhatsApp.update({ where: { id }, data: { responsavelId: null, status: proximoStatus(atual.status, "DEVOLVIDO", false) } });
      await cancelarIntencoesDoResponsavel(tx, id, anterior);
      await registrarEvento(tx, { tipo: "AtendimentoDevolvido", agregadoTipo: "AtendimentoWhatsApp", agregadoId: id, autorId: u.id, payload: { de: anterior, para: null } });
    });
    revalidatePath("/inbox");
  });
}

/** Gerente do setor entrega o atendimento a alguém que atende o setor. */
export async function atribuirAtendimento(input: { atendimentoId: string; usuarioId: string }): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const { atendimentoId: id, usuarioId } = AtribuirSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id = ${id} FOR UPDATE`;
      const a = await atendimentoVisivel(u, id);
      if (!a) throw new ErroRegra(MSG_FORA_DO_ESCOPO);
      if (a.encerradoEm) throw new ErroRegra("Atendimento encerrado.");
      if (!podeExecutar(u, "atribuir", { setor: a.finalidade, responsavelId: a.responsavelId })) throw new ErroRegra(MSG_SEM_ALCADA);
      const alvo = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true } });
      const doSetor = papeisDoSetor(a.finalidade);
      if (!alvo || !alvo.ativo || !alvo.papeis.some((p) => doSetor.includes(p))) throw new ErroRegra("A pessoa escolhida não atende este setor.");
      const atual = await tx.atendimentoWhatsApp.findUniqueOrThrow({ where: { id }, select: { status: true, responsavelId: true } });
      const anterior = atual.responsavelId;
      if (anterior === usuarioId) return;
      await tx.atendimentoWhatsApp.update({ where: { id }, data: { responsavelId: usuarioId, status: proximoStatus(atual.status, "ASSUMIDO", true) } });
      await cancelarIntencoesDoResponsavel(tx, id, anterior);
      await registrarEvento(tx, { tipo: "AtendimentoAtribuido", agregadoTipo: "AtendimentoWhatsApp", agregadoId: id, autorId: u.id, payload: { de: anterior, para: usuarioId } });
    });
    revalidatePath("/inbox");
  });
}
