import { z } from "zod";
import { DataCivilSchema } from "./cobertura";

export const PreviaPausaMatriculasSchema = z.object({
  matriculaIds: z.array(z.string().trim().min(1)).min(1, "Selecione ao menos uma matrícula.").max(100)
    .refine((ids) => new Set(ids).size === ids.length, "Não repita matrículas na seleção."),
  dataEfetiva: DataCivilSchema,
}).strict();
export type PreviaPausaMatriculasInput = z.input<typeof PreviaPausaMatriculasSchema>;

export const SolicitarPausaMatriculasSchema = PreviaPausaMatriculasSchema.extend({
  motivo: z.string().trim().min(5).max(2000),
  chaveIdempotencia: z.string().trim().min(8).max(100),
});
export type SolicitarPausaMatriculasInput = z.input<typeof SolicitarPausaMatriculasSchema>;
export const DecidirPausaMatriculasSchema = z.object({ aprovar: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict();
export type DecidirPausaMatriculasInput = z.input<typeof DecidirPausaMatriculasSchema>;
