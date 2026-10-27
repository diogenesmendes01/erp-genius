import type { Prisma } from "@prisma/client";
type Db = Pick<Prisma.TransactionClient, "$queryRaw">;
export interface ResumoAriaParaNota { acaoId: string; nota: string }
const ESPACOS_TRIM = "\u0009\u000A\u000B\u000C\u000D\u0020\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF";
export async function lerResumoDaAriaParaNota(db: Db, atendimentoId: string): Promise<ResumoAriaParaNota | null> {
  const [linha] = await db.$queryRaw<{ acaoId: string; nota: string }[]>`
    SELECT "id" AS "acaoId", "payload" ->> 'nota' AS "nota"
    FROM "AcaoAgenteIA"
    WHERE "atendimentoId" = ${atendimentoId}
      AND "acao" = 'HANDOFF' AND "status" = 'EXECUTADA'
      AND jsonb_typeof("payload" -> 'nota') = 'string'
      AND btrim("payload" ->> 'nota', ${ESPACOS_TRIM}) <> ''
    ORDER BY "criadoEm" DESC, "id" DESC LIMIT 1`;
  if (!linha || typeof linha.nota !== "string" || !linha.nota.trim()) return null;
  return { acaoId: linha.acaoId, nota: "Resumo da Aria\n" + linha.nota.trim() };
}
export async function resumoDaAriaParaNota(db: Db, atendimentoId: string): Promise<string | null> {
  return (await lerResumoDaAriaParaNota(db, atendimentoId))?.nota ?? null;
}
