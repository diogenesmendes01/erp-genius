import type { Prisma } from "@prisma/client";

export const ATOR_ARIA = "ARIA" as const;

export function payloadDaAria<D extends Record<string, Prisma.InputJsonValue | null>>(
  acaoAgenteIAId: string,
  dados: D,
): { ator: typeof ATOR_ARIA; acaoAgenteIAId: string } & D {
  return { ator: ATOR_ARIA, acaoAgenteIAId, ...dados };
}
