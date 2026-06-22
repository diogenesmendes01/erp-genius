import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Associação professor↔experimental (escopo do professor — Issue #13).
//
// FONTE DE VERDADE: a FK `Lead.professorExperimentalId` (relação
// `professorExperimental`). O evento `ExperimentalAtribuida` é mantido apenas
// como trilha de auditoria (quem atribuiu, quando, de quem para quem).
// Experimentais antigas/sem professor têm a FK NULL → ficam fora do escopo de
// qualquer professor até serem (re)atribuídas.

/** Tipo do evento que audita a atribuição de um professor a uma experimental. */
export const EVENTO_EXPERIMENTAL_ATRIBUIDA = "ExperimentalAtribuida";

/**
 * Professor atualmente atribuído a uma experimental (FK), ou null se não houver
 * vínculo. Fonte: `Lead.professorExperimentalId`.
 */
export async function professorAtribuido(
  client: Prisma.TransactionClient | typeof prisma,
  leadId: string,
): Promise<string | null> {
  const lead = await client.lead.findUnique({
    where: { id: leadId },
    select: { professorExperimentalId: true },
  });
  return lead?.professorExperimentalId ?? null;
}

/**
 * IDs dos leads cuja experimental está atribuída a `professorId` (via FK).
 * Usado pela Home do professor para listar só as experimentais dele.
 */
export async function leadsAtribuidosAoProfessor(professorId: string): Promise<string[]> {
  const leads = await prisma.lead.findMany({
    where: { professorExperimentalId: professorId },
    select: { id: true },
  });
  return leads.map((l) => l.id);
}
