import { z } from "zod";

/** Confirmação humana mínima para preservar o binário já conferido. */
export const PreservarOriginalAditivoSchema = z.object({
  propostaId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  conferenciaId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  conferenciaHash: z.string().regex(/^[a-f0-9]{64}$/),
  motivo: z.string().trim().min(5).max(2000),
  conteudoConferido: z.literal(true),
}).strict();

export type PreservarOriginalAditivoEntrada = z.infer<typeof PreservarOriginalAditivoSchema>;
