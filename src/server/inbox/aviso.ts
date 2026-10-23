import type { Prisma } from "@prisma/client";
import type { prisma } from "@/lib/prisma";

/**
 * Toca a linha na transação chamadora para reutilizar notificar_inbox_atendimento.
 * O trigger publica somente tipo/IDs no commit; rollback não publica.
 * Não valida escopo ou alçada: a ação deve autorizá-los antes da escrita.
 */
export async function avisarAtendimento(db: Prisma.TransactionClient | typeof prisma, atendimentoId: string): Promise<void> {
  await db.$executeRaw`UPDATE "AtendimentoWhatsApp" SET "id" = "id" WHERE "id" = ${atendimentoId}`;
}
