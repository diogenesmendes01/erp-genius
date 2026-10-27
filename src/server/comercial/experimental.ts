import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const EVENTO_EXPERIMENTAL_ATRIBUIDA = "ExperimentalAtribuida";

export async function professorAtribuido(
  client: Prisma.TransactionClient | typeof prisma,
  leadId: string,
): Promise<string | null> {
  const lead = await client.oportunidade.findUnique({
    where: { id: leadId },
    select: { professorExperimentalId: true },
  });
  return lead?.professorExperimentalId ?? null;
}

export async function leadsAtribuidosAoProfessor(professorId: string): Promise<string[]> {
  const leads = await prisma.oportunidade.findMany({
    where: { professorExperimentalId: professorId },
    select: { id: true },
  });
  return leads.map((l) => l.id);
}
