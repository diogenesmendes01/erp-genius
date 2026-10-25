import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { ConfigAriaSchema,type ConfigAria } from "../config-schema";
export const CAMPOS_INSIGHT=["etapa","interesse","objetivo","urgencia","orcamento","objecao","proximaAcao"] as const;
export const SnapshotInsightSchema=z.object({
  versao:z.literal(1),configPublicada:ConfigAriaSchema,
  camposAutorizados:z.array(z.enum(CAMPOS_INSIGHT)).length(CAMPOS_INSIGHT.length).refine(v=>new Set(v).size===CAMPOS_INSIGHT.length),
  base:z.object({ultimaMensagemEmISO:z.string().datetime().nullable(),referenciasHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
}).strict();
export function criarSnapshotInsight(config:ConfigAria,referenciasHash:string) {
  return SnapshotInsightSchema.parse({versao:1,configPublicada:config,camposAutorizados:[...CAMPOS_INSIGHT],base:{ultimaMensagemEmISO:null,referenciasHash}});
}
/** Fronteira JSON para snapshots previamente validados; não guarda prompt/mensagens. */
export function jsonInsight(valor:unknown):Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
}
