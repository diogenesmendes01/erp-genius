import { z } from "zod";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";
export const RascunhoEncontroSchema = z.object({
  turmaId: z.string().min(1).optional(), matriculaId: z.string().min(1).optional(),
  professorId: z.string().min(1).optional(), inicio: z.string().datetime({ offset: true }), fim: z.string().datetime({ offset: true }),
  fusoOrigem: FusoInstitucionalSchema, motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100),
}).strict().superRefine((d, ctx) => {
  if (Boolean(d.turmaId) === Boolean(d.matriculaId)) ctx.addIssue({ code: "custom", message: "Identifique uma turma coletiva ou uma matrícula de particular, sem misturar os vínculos." });
  if (Date.parse(d.fim) <= Date.parse(d.inicio)) ctx.addIssue({ code: "custom", message: "O fim deve ser posterior ao início do encontro." });
});
