import { z } from "zod";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { DataCivilSchema } from "@/server/matricula/cobertura";
export const PeriodosCalendarioSchema = z.array(z.object({
  id: z.string().min(1).max(100), nome: z.string().trim().min(2).max(200),
  tipo: z.enum(["FERIADO", "RECESSO", "FERIAS"]), inicio: DataCivilSchema, fim: DataCivilSchema,
}).strict()).max(10000).superRefine((periodos, ctx) => {
  if (new Set(periodos.map((p) => p.id)).size !== periodos.length) ctx.addIssue({ code: "custom", message: "Identificador de período repetido." });
  if (periodos.some((p) => p.fim < p.inicio)) ctx.addIssue({ code: "custom", message: "Período do calendário invertido." });
});
export const PropostaCalendarioSchema = z.object({
  fusoConferido: FusoInstitucionalSchema,
  versaoAnterior: z.number().int().nonnegative(), periodos: PeriodosCalendarioSchema,
  motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100),
}).strict();
