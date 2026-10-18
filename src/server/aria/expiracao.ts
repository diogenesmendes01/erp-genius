import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/server/_shared/evento";
import { payloadDaAria } from "./ator";
import { montarContextoTurno } from "./turno/contexto";
import { executarHandoff } from "./turno/handoff";
import { situacaoAria } from "./estado";
import { versaoPublicada } from "./versoes";

// Expiração das sugestões da Aria (Task 25): SUGERIDA com `expiraEm <= agora` vira EXPIRADA. Se a
// versão publicada manda HANDOFF, o atendimento é passado a uma pessoa UMA vez (a primeira ação
// expirada pausa a Aria; as seguintes do mesmo atendimento só expiram). Idempotente: o FOR UPDATE
// e a reconferência do status impedem expirar duas vezes.

type Tx = Prisma.TransactionClient;

const LOTE = 200;

async function expirarUma(tx: Tx, id: string, agora: Date, comHandoff: boolean): Promise<{ expirou: boolean; handoff: boolean }> {
  await tx.$queryRaw`SELECT id FROM "AcaoAgenteIA" WHERE id = ${id} FOR UPDATE`;
  const acao = await tx.acaoAgenteIA.findUnique({ where: { id } });
  if (!acao || acao.status !== "SUGERIDA" || !acao.expiraEm || acao.expiraEm.getTime() > agora.getTime()) {
    return { expirou: false, handoff: false };
  }
  await tx.acaoAgenteIA.update({ where: { id }, data: { status: "EXPIRADA", decididaEm: agora } });
  await registrarEvento(tx, {
    tipo: "AcaoAriaExpirada",
    agregadoTipo: "AcaoAgenteIA",
    agregadoId: acao.id,
    autorId: null,
    payload: payloadDaAria(acao.id, { acao: acao.acao }),
  });
  if (!comHandoff || !acao.atendimentoId) return { expirou: true, handoff: false };

  await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id = ${acao.atendimentoId} FOR UPDATE`;
  const at = await tx.atendimentoWhatsApp.findUnique({
    where: { id: acao.atendimentoId },
    select: { iaPausadaEm: true, encerradoEm: true, conversa: { select: { contatoId: true } } },
  });
  if (!at || at.iaPausadaEm || at.encerradoEm || !at.conversa.contatoId) return { expirou: true, handoff: false };

  const config = (await versaoPublicada(tx))?.config;
  if (!config) return { expirou: true, handoff: false };
  const ctx = { ...(await montarContextoTurno(acao.atendimentoId, tx)), primeiraDaAria: false };
  await executarHandoff(tx, { turnoId: acao.turnoId, ctx, motivo: "CONFIANCA", config, simulado: false, resumo: null });
  return { expirou: true, handoff: true };
}

export async function expirarSugestoesAria(agora: Date = new Date()): Promise<{ expiradas: number; handoffs: number }> {
  const total = { expiradas: 0, handoffs: 0 };
  // Handoff só com a Aria ATIVA e não pausada globalmente: DESLIGADA, SHADOW (que não age de verdade) e pausada só expiram a sugestão.
  const { estado, pausada, versao } = await situacaoAria(agora);
  const comHandoff = estado === "ATIVA" && !pausada && versao?.config.confianca.acaoExpiracao === "HANDOFF";
  const vencidas = await prisma.acaoAgenteIA.findMany({
    where: { status: "SUGERIDA", expiraEm: { lte: agora } },
    orderBy: [{ expiraEm: "asc" }, { id: "asc" }],
    take: LOTE,
    select: { id: true },
  });
  for (const { id } of vencidas) {
    try {
      const r = await prisma.$transaction((tx) => expirarUma(tx, id, agora, comHandoff));
      if (r.expirou) total.expiradas += 1;
      if (r.handoff) total.handoffs += 1;
    } catch (e) {
      console.error(`[aria-expiracao] ${id} falhou:`, e);
    }
  }
  return total;
}
