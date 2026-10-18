import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type TrechoEncontrado = { id: string; fonteId: string; texto: string; rank: number };

/** Busca textual em português (websearch_to_tsquery) só nas fontes informadas PRONTAS, não arquivadas e dentro da validade. */
export async function buscarTrechos(consulta: string, fonteIds: string[], limite = 5): Promise<TrechoEncontrado[]> {
  if (fonteIds.length === 0 || consulta.trim() === "") return [];
  const max = Math.max(1, Math.min(50, Math.trunc(limite)));
  const linhas = await prisma.$queryRaw<{ id: string; fonteId: string; texto: string; rank: number }[]>(Prisma.sql`
    SELECT t."id", t."fonteId", t."texto", ts_rank(t."busca", q.q)::float8 AS "rank"
    FROM "TrechoConhecimento" t
    JOIN "FonteConhecimento" f ON f."id" = t."fonteId"
    CROSS JOIN (SELECT websearch_to_tsquery('portuguese', ${consulta}) AS q) q
    WHERE t."fonteId" = ANY(${fonteIds}::text[])
      AND f."status" = 'PRONTA' AND f."arquivadaEm" IS NULL
      AND (f."validoAte" IS NULL OR f."validoAte" > now())
      AND t."busca" @@ q.q
    ORDER BY "rank" DESC, t."fonteId", t."ordem"
    LIMIT ${max}`);
  return linhas;
}
