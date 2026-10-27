import type { Prisma } from "@prisma/client";
import type { prisma } from "@/lib/prisma";

export async function avisarAtendimento(db: Prisma.TransactionClient | typeof prisma, atendimentoId: string): Promise<void> {
  await db.$executeRaw`UPDATE "AtendimentoWhatsApp" SET "id" = "id" WHERE "id" = ${atendimentoId}`;
}
