import type { Prisma } from "@prisma/client";
import { CANAL_INBOX, type AvisoInbox } from "@/server/inbox/barramento";

export async function avisarNovaConversaTx(tx: Prisma.TransactionClient, a: { id: string; conversaId: string }): Promise<void> {
 const aviso: AvisoInbox = { tipo: "atendimento.atualizado", atendimentoId: a.id, mensagemId: null, conversaId: a.conversaId };
 await tx.$executeRaw`SELECT pg_notify(${CANAL_INBOX}, json_build_object('tipo', 'atendimento.atualizado', 'atendimentoId', ${aviso.atendimentoId}::text, 'mensagemId', NULL, 'conversaId', ${aviso.conversaId}::text)::text)`;
}