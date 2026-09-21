import { z } from "zod";
import { AutorizarRecuperacaoEspecialSchema } from "./recuperacao-autorizacao-schema";

export const AutorizarPreparacaoRecuperacaoSchema = AutorizarRecuperacaoEspecialSchema.omit({ itemReservaId: true }).extend({
  alocacaoId: z.string().trim().min(1).max(100),
}).strict();
