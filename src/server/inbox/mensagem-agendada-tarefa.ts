import type { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared/sessao";
import { registrarEvento } from "@/server/_shared/evento";
import { valorCampoLocal } from "@/server/operacao/fuso-entrada";
import type { Db } from "@/server/whatsapp/escopo";
import {
  quandoDaMensagemAgendada,
  type DecisaoMensagemAgendada,
  type MensagemAgendadaDaTarefa,
} from "@/lib/selo-mensagem-agendada";

// ADIADA cobre o equivalente de "aguardando confirmação" (motivo aguarda_confirmacao_resposta).
// O schema não tem status AGUARDANDO_CONFIRMACAO nem coluna canceladaEm em IntencaoMensagem.
export const STATUS_MENSAGEM_AGENDADA_ATIVA = ["PENDENTE", "ADIADA"] as const;
export const MOTIVO_CANCELADA_COM_TAREFA = "cancelada_com_a_tarefa";

export function decisaoCancelaMensagem(decisao: DecisaoMensagemAgendada | undefined): decisao is "cancelar" {
  return decisao === "cancelar";
}

export async function carregarMensagensAgendadasDasTarefas(
  db: Db,
  tarefas: readonly { id: string; fusoOrigem: string }[],
): Promise<Map<string, MensagemAgendadaDaTarefa>> {
  const mapa = new Map<string, MensagemAgendadaDaTarefa>();
  if (!tarefas.length) return mapa;
  const fuso = new Map(tarefas.map((t) => [t.id, t.fusoOrigem]));
  const linhas = await db.intencaoMensagem.findMany({
    where: {
      tarefaId: { in: tarefas.map((t) => t.id) },
      status: { in: [...STATUS_MENSAGEM_AGENDADA_ATIVA] },
      agendadaPara: { not: null },
    },
    select: { id: true, tarefaId: true, status: true, agendadaPara: true },
    orderBy: [{ agendadaPara: "asc" }, { id: "asc" }],
  });
  for (const m of linhas) {
    if (!m.tarefaId || !m.agendadaPara || mapa.has(m.tarefaId)) continue;
    if (m.status !== "PENDENTE" && m.status !== "ADIADA") continue;
    const quando = quandoDaMensagemAgendada(valorCampoLocal(m.agendadaPara, fuso.get(m.tarefaId) ?? "UTC"));
    if (!quando) continue;
    mapa.set(m.tarefaId, { id: m.id, status: m.status, agendadaPara: m.agendadaPara.toISOString(), quando });
  }
  return mapa;
}

export async function resumoMensagemAgendadaDaTarefa(db: Db, tarefaId: string, fusoOrigem: string): Promise<MensagemAgendadaDaTarefa | null> {
  return (await carregarMensagensAgendadasDasTarefas(db, [{ id: tarefaId, fusoOrigem }])).get(tarefaId) ?? null;
}

export async function cancelarMensagensAgendadasDaTarefaTx(tx: Prisma.TransactionClient, autorId: string, tarefaId: string): Promise<void> {
  const candidatas = await tx.intencaoMensagem.findMany({
    where: { tarefaId, status: { in: [...STATUS_MENSAGEM_AGENDADA_ATIVA] }, agendadaPara: { not: null } },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  const agora = new Date();
  for (const { id } of candidatas) {
    await tx.$queryRaw`SELECT id FROM "IntencaoMensagem" WHERE id=${id} AND "tarefaId"=${tarefaId} FOR UPDATE`;
    const m = await tx.intencaoMensagem.findFirst({
      where: { id, tarefaId, status: { in: [...STATUS_MENSAGEM_AGENDADA_ATIVA] }, agendadaPara: { not: null } },
      select: { id: true, status: true, agendadaPara: true, atendimentoId: true },
    });
    if (!m?.agendadaPara) continue;
    const r = await tx.intencaoMensagem.updateMany({
      where: { id: m.id, tarefaId, status: m.status, agendadaPara: m.agendadaPara },
      data: { status: "CANCELADA", motivoFalha: MOTIVO_CANCELADA_COM_TAREFA },
    });
    if (r.count !== 1) throw new ErroRegra("A mensagem agendada mudou. Recarregue a tarefa.");
    await registrarEvento(tx, {
      tipo: "MensagemAgendadaCancelada",
      agregadoTipo: m.atendimentoId ? "AtendimentoWhatsApp" : "IntencaoMensagem",
      agregadoId: m.atendimentoId ?? m.id,
      autorId,
      payload: {
        contexto: "tarefa379",
        operacao: "CANCELAR",
        intencaoId: m.id,
        tarefaId,
        atendimentoId: m.atendimentoId,
        canceladaEm: agora.toISOString(),
      },
    });
  }
}
