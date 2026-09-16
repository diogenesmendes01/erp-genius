import { z } from "zod";
import { DataCivilSchema } from "./cobertura";

export const SolicitarEncerramentoSchema = z.object({
  alunoId: z.string().trim().min(1),
  matriculaIds: z.array(z.string().trim().min(1)).min(1).max(100)
    .refine((ids) => new Set(ids).size === ids.length, "Não repita matrículas."),
  dataSolicitada: DataCivilSchema,
  motivo: z.string().trim().min(5).max(2000),
  evidenciaPedido: z.string().trim().min(5).max(2000),
  motivoRetroatividade: z.string().trim().min(5).max(2000).optional(),
  evidenciaRetroatividade: z.string().trim().min(5).max(2000).optional(),
  chaveIdempotencia: z.string().trim().min(8).max(100),
}).strict();
export type SolicitarEncerramentoInput = z.input<typeof SolicitarEncerramentoSchema>;
