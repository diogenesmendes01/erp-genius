import type { Prisma } from "@prisma/client";

// Autoria da Aria (ADR-F5-01, DF5-2): a Aria nunca é um Usuario. Toda mutação feita por
// ela grava o Evento com autorId nulo e este marcador no payload, ligando ao registro
// AcaoAgenteIA que a originou.

export const ATOR_ARIA = "ARIA" as const;

export function payloadDaAria<D extends Record<string, Prisma.InputJsonValue | null>>(
  acaoAgenteIAId: string,
  dados: D,
): { ator: typeof ATOR_ARIA; acaoAgenteIAId: string } & D {
  return { ator: ATOR_ARIA, acaoAgenteIAId, ...dados };
}
