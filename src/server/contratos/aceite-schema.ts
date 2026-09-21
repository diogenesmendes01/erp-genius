import { z } from "zod";
export const Alvo = z.object({ matriculaId: z.string().min(1).max(100), conclusaoId: z.string().min(1).max(100) }).strict();
export const Confirmar = Alvo.extend({ revisaoHash: z.string().regex(/^[a-f0-9]{64}$/), evidenciasConferidas: z.literal(true),
  motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict();

