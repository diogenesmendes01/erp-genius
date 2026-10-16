"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessao, type Resultado } from "@/server/_shared";
import { atendimentoVisivel } from "./atendimentos";

// Preferências pessoais: tabelas operacionais, sem Evento (precedente: marcarConversaLida em acoes.ts).

async function conversaDoAtendimento(atendimentoId: string) {
  const autor = await exigirSessao();
  const a = await atendimentoVisivel(autor, atendimentoId);
  if (!a) throw new ErroRegra("Conversa não encontrada ou fora do seu escopo.");
  return { usuarioId: autor.id, conversaId: a.conversaId };
}

const chave = (usuarioId: string, conversaId: string) => ({ usuarioId_conversaId: { usuarioId, conversaId } });

export async function alternarFixada(atendimentoId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const { usuarioId, conversaId } = await conversaDoAtendimento(atendimentoId);
    const atual = await prisma.preferenciaConversaUsuario.findUnique({ where: chave(usuarioId, conversaId) });
    const fixadaEm = atual?.fixadaEm ? null : new Date();
    await prisma.preferenciaConversaUsuario.upsert({
      where: chave(usuarioId, conversaId), create: { usuarioId, conversaId, fixadaEm }, update: { fixadaEm } });
    revalidatePath("/inbox");
  });
}

/** `ate` ISO = silencia até lá; null reativa. */
export async function silenciarConversa(atendimentoId: string, ate: string | null): Promise<Resultado> {
  return executarAcao(async () => {
    const { usuarioId, conversaId } = await conversaDoAtendimento(atendimentoId);
    let silenciadaAte: Date | null = null;
    if (ate !== null) {
      silenciadaAte = new Date(ate);
      if (Number.isNaN(silenciadaAte.getTime())) throw new ErroRegra("Data de silêncio inválida.");
    }
    await prisma.preferenciaConversaUsuario.upsert({
      where: chave(usuarioId, conversaId), create: { usuarioId, conversaId, silenciadaAte }, update: { silenciadaAte } });
    revalidatePath("/inbox");
  });
}

export async function marcarNaoLida(atendimentoId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const { usuarioId, conversaId } = await conversaDoAtendimento(atendimentoId);
    await prisma.preferenciaConversaUsuario.upsert({
      where: chave(usuarioId, conversaId), create: { usuarioId, conversaId, marcadaNaoLida: true }, update: { marcadaNaoLida: true } });
    revalidatePath("/inbox");
  });
}

export async function marcarLida(atendimentoId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const { usuarioId, conversaId } = await conversaDoAtendimento(atendimentoId);
    const lidaAte = new Date();
    await prisma.preferenciaConversaUsuario.upsert({
      where: chave(usuarioId, conversaId), create: { usuarioId, conversaId, lidaAte }, update: { lidaAte, marcadaNaoLida: false } });
    revalidatePath("/inbox");
  });
}

export async function alternarFavorita(mensagemId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    const m = await prisma.mensagemWhatsApp.findUnique({ where: { id: mensagemId }, select: { atendimentoId: true } });
    // Mensagem sem atendimento (grupo/triagem) não é visível pelo escopo de atendimento.
    const visivel = m?.atendimentoId ? await atendimentoVisivel(autor, m.atendimentoId) : null;
    if (!visivel) throw new ErroRegra("Mensagem não encontrada ou fora do seu escopo.");
    const where = { usuarioId_mensagemId: { usuarioId: autor.id, mensagemId } };
    if (await prisma.favoritoMensagemUsuario.findUnique({ where })) {
      await prisma.favoritoMensagemUsuario.delete({ where });
    } else {
      await prisma.favoritoMensagemUsuario.upsert({ where, create: { usuarioId: autor.id, mensagemId }, update: {} });
    }
    revalidatePath("/inbox");
  });
}

export type PreferenciaDoAtendimento = { fixada: boolean; silenciada: boolean; naoLidas: number };

/**
 * Preferências do usuário para uma página de atendimentos (chave = id do atendimento).
 * naoLidas pessoal: ENTRADA do atendimento depois de lidaAte (no mínimo 1 se marcada como não lida);
 * sem lidaAte, vale o contador compartilhado do atendimento.
 */
export async function preferenciasDoUsuario(usuarioId: string, atendimentoIds: string[]): Promise<Map<string, PreferenciaDoAtendimento>> {
  const resultado = new Map<string, PreferenciaDoAtendimento>();
  if (!atendimentoIds.length) return resultado;
  const atendimentos = await prisma.atendimentoWhatsApp.findMany({
    where: { id: { in: atendimentoIds } }, select: { id: true, conversaId: true, naoLidas: true } });
  const prefs = await prisma.preferenciaConversaUsuario.findMany({
    where: { usuarioId, conversaId: { in: atendimentos.map((a) => a.conversaId) } } });
  const porConversa = new Map(prefs.map((p) => [p.conversaId, p]));
  const agora = new Date();
  // Atendimentos com lidaAte: contagem por groupBy, um grupo por instante de leitura.
  const contagens = new Map<string, number>();
  const porLidaAte = new Map<number, string[]>();
  for (const a of atendimentos) {
    const lidaAte = porConversa.get(a.conversaId)?.lidaAte;
    if (!lidaAte) continue;
    porLidaAte.set(lidaAte.getTime(), [...(porLidaAte.get(lidaAte.getTime()) ?? []), a.id]);
  }
  await Promise.all([...porLidaAte].map(async ([t, ids]) => {
    const grupos = await prisma.mensagemWhatsApp.groupBy({
      by: ["atendimentoId"], _count: { _all: true },
      where: { atendimentoId: { in: ids }, direcao: "ENTRADA", criadoEm: { gt: new Date(t) } } });
    for (const g of grupos) if (g.atendimentoId) contagens.set(g.atendimentoId, g._count._all);
  }));
  for (const a of atendimentos) {
    const p = porConversa.get(a.conversaId);
    const base = p?.lidaAte ? (contagens.get(a.id) ?? 0) : a.naoLidas;
    resultado.set(a.id, {
      fixada: !!p?.fixadaEm,
      silenciada: !!p?.silenciadaAte && p.silenciadaAte > agora,
      naoLidas: p?.marcadaNaoLida ? Math.max(1, base) : base,
    });
  }
  return resultado;
}
