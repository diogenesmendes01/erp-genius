import type { MotivoPausaAtendimentoIA, OrigemEnvio, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessao, registrarEvento, type Resultado, type UsuarioSessao } from "../_shared";
import { escopoAtendimentos } from "../whatsapp/escopo";

// Pausa da Aria por atendimento: quando um humano responde (ERP ou celular) a Aria sai da conversa
// até alguém devolvê-la. Chamado na MESMA transação que grava a mensagem de saída.

type Tx = Prisma.TransactionClient;

/** Motivo gravado nas intenções da Aria canceladas porque ela saiu da conversa. */
export const MOTIVO_ARIA_PAUSADA = "aria_pausada";

/**
 * Cancela as intenções da Aria (origem IA) ainda não enviadas do atendimento: resposta pendente,
 * mensagem agendada por ela (ADIADA/PENDENTE com agendadaPara). `preservarIntencaoId` é a
 * mensagem do próprio handoff, que precisa sair. Interna (trava de auditoria da Task 43): só
 * `pausarAriaNoAtendimento` a usa, na transação do chamador.
 */
async function cancelarIntencoesDaAria(tx: Tx, atendimentoId: string, preservarIntencaoId: string | null = null): Promise<number> {
  const r = await tx.intencaoMensagem.updateMany({
    where: {
      atendimentoId,
      origem: "IA",
      status: { in: ["PENDENTE", "ADIADA"] },
      ...(preservarIntencaoId ? { id: { not: preservarIntencaoId } } : {}),
    },
    data: { status: "CANCELADA", motivoFalha: MOTIVO_ARIA_PAUSADA, despacharAposEm: null },
  });
  return r.count;
}

/**
 * true se pausou agora; false se já estava pausado (idempotente, sem novo Evento).
 * Em qualquer caso cancela, na mesma transação, as intenções pendentes da Aria no atendimento
 * (uma pessoa assumiu: nada da Aria pode sair depois), exceto `preservarIntencaoId`.
 */
export async function pausarAriaNoAtendimento(
  tx: Tx,
  atendimentoId: string,
  motivo: MotivoPausaAtendimentoIA,
  autorId: string | null,
  opcoes: { preservarIntencaoId?: string | null } = {},
): Promise<boolean> {
  await cancelarIntencoesDaAria(tx, atendimentoId, opcoes.preservarIntencaoId ?? null);
  const r = await tx.atendimentoWhatsApp.updateMany({
    where: { id: atendimentoId, iaPausadaEm: null },
    data: { iaPausadaEm: new Date(), iaPausaMotivo: motivo },
  });
  if (r.count === 0) return false;
  await registrarEvento(tx, {
    tipo: "AriaPausadaNoAtendimento",
    agregadoTipo: "AtendimentoWhatsApp",
    agregadoId: atendimentoId,
    autorId,
    payload: { motivo },
  });
  return true;
}

/** Só saída HUMANO (ERP) ou CELULAR (eco) pausa; IA, CRON, LOTE e GESTAO nunca. */
export async function aoGravarSaidaHumana(
  tx: Tx,
  m: { atendimentoId: string | null; origem: OrigemEnvio | null; autorId: string | null },
): Promise<void> {
  if (!m.atendimentoId) return;
  if (m.origem === "HUMANO") await pausarAriaNoAtendimento(tx, m.atendimentoId, "HUMANO_RESPONDEU", m.autorId);
  else if (m.origem === "CELULAR") await pausarAriaNoAtendimento(tx, m.atendimentoId, "CELULAR", m.autorId);
}

/**
 * Devolver põe a Aria para FALAR com o contato: exige o escopo de envio, não só o de leitura. Regra
 * única da action (`devolverParaAria`) e do botão "Devolver para Aria" no Inbox (`carregarAriaDoAtendimento`).
 */
export async function podeDevolverParaAria(db: Tx | typeof prisma, u: UsuarioSessao, atendimentoId: string): Promise<boolean> {
  const visivel = await db.atendimentoWhatsApp.count({ where: { AND: [{ id: atendimentoId }, await escopoAtendimentos(u, { enviar: true })] } });
  return visivel === 1;
}

export async function devolverParaAria(atendimentoId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    await prisma.$transaction(async (tx) => {
      if (!(await podeDevolverParaAria(tx, u, atendimentoId))) throw new ErroRegra("Atendimento fora do seu escopo.");
      const r = await tx.atendimentoWhatsApp.updateMany({
        where: { id: atendimentoId, iaPausadaEm: { not: null } },
        data: { iaPausadaEm: null, iaPausaMotivo: null, iaRetomadaEm: new Date(), iaRetomadaPorId: u.id },
      });
      if (r.count === 0) return;
      await registrarEvento(tx, {
        tipo: "AriaDevolvida",
        agregadoTipo: "AtendimentoWhatsApp",
        agregadoId: atendimentoId,
        autorId: u.id,
        payload: {},
      });
    });
  });
}
