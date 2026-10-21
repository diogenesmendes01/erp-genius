import { z } from "zod";

export const EmitirContinuidadeMensalSchema = z.object({
  matriculaId: z.string().trim().min(1),
  ultimaCobrancaIdEsperada: z.string().trim().min(1),
}).strict();
