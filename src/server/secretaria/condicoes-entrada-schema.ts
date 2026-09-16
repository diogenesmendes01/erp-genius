import { z } from "zod";
import { DataCivilSchema, CoberturaInicialSchema } from "@/server/matricula/cobertura";
export const Entrada = z.object({ matriculaId: z.string().min(1), pagadorRegistroId: z.string().min(1), versaoEsperada: z.number().int().nonnegative(),
  taxaVencimento: DataCivilSchema,
  aulas: z.discriminatedUnion("regime", [
    z.object({ regime: z.literal("MENSALIDADE"), cobertura: CoberturaInicialSchema, primeiroVencimento: DataCivilSchema, diaVencimentoContratado: z.number().int().min(1).max(31) }).strict(),
    z.object({ regime: z.literal("HORA_PARTICULAR"), vencimentoAdiantamento: DataCivilSchema.optional() }).strict(),
  ]), motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict();

