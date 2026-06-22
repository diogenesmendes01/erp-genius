import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Associação professor↔experimental (escopo do professor — Issue #13).
//
// Não há FK lead↔professor no V0 (pendência de modelagem, docs/15 e docs/09
// §Visão do Professor). O vínculo é gravado no event log (espinha dorsal do
// schema) como `ExperimentalAtribuida` { professorId }. Estas funções leem/
// gravam esse vínculo sem precisar de migration.

/** Tipo do evento que vincula um professor a uma experimental (lead). */
export const EVENTO_EXPERIMENTAL_ATRIBUIDA = "ExperimentalAtribuida";

interface PayloadAtribuicao {
  professorId?: string;
}

/**
 * Professor atualmente atribuído a uma experimental (última atribuição válida),
 * ou null se nunca houve atribuição. Fonte: event log.
 */
export async function professorAtribuido(
  client: Prisma.TransactionClient | typeof prisma,
  leadId: string,
): Promise<string | null> {
  const evento = await client.evento.findFirst({
    where: {
      tipo: EVENTO_EXPERIMENTAL_ATRIBUIDA,
      agregadoTipo: "Lead",
      agregadoId: leadId,
    },
    orderBy: { criadoEm: "desc" },
    select: { payload: true },
  });
  if (!evento?.payload) return null;
  const payload = evento.payload as PayloadAtribuicao;
  return payload.professorId ?? null;
}

/**
 * IDs dos leads cuja última atribuição de experimental aponta para `professorId`.
 * Usado pela Home do professor para listar só as experimentais dele.
 */
export async function leadsAtribuidosAoProfessor(professorId: string): Promise<string[]> {
  const eventos = await prisma.evento.findMany({
    where: { tipo: EVENTO_EXPERIMENTAL_ATRIBUIDA, agregadoTipo: "Lead" },
    orderBy: { criadoEm: "desc" },
    select: { agregadoId: true, payload: true },
  });

  // Mantém só a última atribuição por lead (eventos já vêm do mais novo p/ o mais antigo).
  const vistos = new Set<string>();
  const meus: string[] = [];
  for (const e of eventos) {
    if (vistos.has(e.agregadoId)) continue;
    vistos.add(e.agregadoId);
    const payload = (e.payload ?? null) as PayloadAtribuicao | null;
    if (payload?.professorId === professorId) meus.push(e.agregadoId);
  }
  return meus;
}
