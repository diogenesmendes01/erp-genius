import { z } from "zod";

export const EnvelopeMotorSchema = z.object({
  idEvento: z.string().uuid(),
  tipo: z.string().min(1),
  numeroId: z.string().min(1),
  ocorridoEm: z.number(),
  dados: z.unknown(),
});

export type EnvelopeMotor = z.infer<typeof EnvelopeMotorSchema>;
