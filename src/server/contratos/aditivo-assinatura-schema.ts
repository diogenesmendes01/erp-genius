import { z } from "zod";

export const RegistrarConferenciaAssinaturaAditivoSchema = z.object({
  matriculaId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  propostaId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  artefatoId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  revisaoHash: z.string().regex(/^[a-f0-9]{64}$/),
  dadosConferidos: z.literal(true),
  motivo: z.string().trim().min(5).max(2000),
  chaveIdempotencia: z.string().trim().min(8).max(100),
}).strict();
