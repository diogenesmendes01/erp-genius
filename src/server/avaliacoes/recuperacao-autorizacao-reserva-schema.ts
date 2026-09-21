import { z } from "zod";
import { AutorizarRecuperacaoEspecialSchema } from "./recuperacao-autorizacao-schema";
import { HABILIDADES } from "./calculo";

export const AutorizarReservaEspecialRecuperacaoSchema = AutorizarRecuperacaoEspecialSchema.omit({ itemReservaId: true }).extend({
  propostaId: z.string().trim().min(1).max(100),
  habilidade: z.enum(HABILIDADES),
}).strict();
