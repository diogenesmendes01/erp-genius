import type { Prisma, StatusAtendimentoWhatsApp } from "@prisma/client";
import type { Setor } from "./setor";

export type EventoStatus = "ASSUMIDO" | "DEVOLVIDO" | "INBOUND" | "RESPOSTA_HUMANA" | "ENCERRADO";

/** Máquina de status do atendimento (E3.3). ENCERRADO é terminal: reabrir cria outro atendimento. */
export function proximoStatus(atual: StatusAtendimentoWhatsApp, evento: EventoStatus, temResponsavel: boolean): StatusAtendimentoWhatsApp {
  if (atual === "ENCERRADO" || evento === "ENCERRADO") return "ENCERRADO";
  switch (evento) {
    case "ASSUMIDO": return "EM_ATENDIMENTO";
    case "DEVOLVIDO": return "ABERTO_SEM_RESPONSAVEL";
    case "RESPOSTA_HUMANA": return "AGUARDANDO_CLIENTE";
    case "INBOUND":
      if (atual !== "AGUARDANDO_CLIENTE") return atual;
      return temResponsavel ? "EM_ATENDIMENTO" : "ABERTO_SEM_RESPONSAVEL";
  }
}

/** Prazo de 1ª resposta do setor a partir de `inicio`; null quando o setor não tem prazo configurado. */
export async function prazoRespostaEm(db: Prisma.TransactionClient, finalidade: Setor, inicio: Date): Promise<Date | null> {
  const p = await db.prazoRespostaSetor.findUnique({ where: { finalidade }, select: { minutos: true } });
  return p ? new Date(inicio.getTime() + p.minutos * 60_000) : null;
}

/**
 * Inbound do cliente: marca o 1º inbound e o prazo (só enquanto não houve resposta) e tira o
 * atendimento de AGUARDANDO_CLIENTE (EM_ATENDIMENTO com responsável, senão ABERTO_SEM_RESPONSAVEL).
 */
export async function aplicarInbound(tx: Prisma.TransactionClient, atendimentoId: string, quando: Date): Promise<void> {
  const a = await tx.atendimentoWhatsApp.findUnique({
    where: { id: atendimentoId },
    select: { status: true, finalidade: true, responsavelId: true, primeiroInboundEm: true, primeiraRespostaEm: true, prazoRespostaEm: true },
  });
  if (!a || a.status === "ENCERRADO") return;
  const data: Prisma.AtendimentoWhatsAppUpdateInput = {};
  const status = proximoStatus(a.status, "INBOUND", !!a.responsavelId);
  if (status !== a.status) data.status = status;
  if (!a.primeiroInboundEm) data.primeiroInboundEm = quando;
  if (!a.primeiraRespostaEm && !a.prazoRespostaEm) {
    const prazo = await prazoRespostaEm(tx, a.finalidade, a.primeiroInboundEm ?? quando);
    if (prazo) data.prazoRespostaEm = prazo;
  }
  if (Object.keys(data).length) await tx.atendimentoWhatsApp.update({ where: { id: atendimentoId }, data });
}

/** Resposta humana (SAIDA origem HUMANO): grava a 1ª resposta uma vez e passa a AGUARDANDO_CLIENTE. */
export async function aplicarResposta(tx: Prisma.TransactionClient, atendimentoId: string, quando: Date): Promise<void> {
  const a = await tx.atendimentoWhatsApp.findUnique({ where: { id: atendimentoId }, select: { status: true, primeiraRespostaEm: true } });
  if (!a || a.status === "ENCERRADO") return;
  const status = proximoStatus(a.status, "RESPOSTA_HUMANA", true);
  const data: Prisma.AtendimentoWhatsAppUpdateInput = {};
  if (status !== a.status) data.status = status;
  if (!a.primeiraRespostaEm) data.primeiraRespostaEm = quando;
  if (Object.keys(data).length) await tx.atendimentoWhatsApp.update({ where: { id: atendimentoId }, data });
}

/** Chave do atendimento reaberto: `base#2`, `base#3`… (`anteriores` = quantos já existiram com a base). */
export function chaveDeReabertura(base: string, anteriores: number): string {
  return `${base}#${anteriores + 1}`;
}
