import type { MotivoPausaAtendimentoIA, OrigemEnvio, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessao, registrarEvento, type Resultado } from "../_shared";
import { escopoAtendimentos } from "../whatsapp/escopo";

// Pausa da Aria por atendimento: quando um humano responde (ERP ou celular) a Aria sai da conversa
// até alguém devolvê-la. Chamado na MESMA transação que grava a mensagem de saída.

type Tx = Prisma.TransactionClient;

/** true se pausou agora; false se já estava pausado (idempotente, sem novo Evento). */
export async function pausarAriaNoAtendimento(
  tx: Tx,
  atendimentoId: string,
  motivo: MotivoPausaAtendimentoIA,
  autorId: string | null,
): Promise<boolean> {
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

export async function devolverParaAria(atendimentoId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    await prisma.$transaction(async (tx) => {
      const visivel = await tx.atendimentoWhatsApp.count({ where: { AND: [{ id: atendimentoId }, await escopoAtendimentos(u)] } });
      if (visivel !== 1) throw new ErroRegra("Atendimento fora do seu escopo.");
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
