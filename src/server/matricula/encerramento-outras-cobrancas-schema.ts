import { z } from "zod";
export const OutrasCobrancasEncerramentoSchema = z.array(z.object({
  cobrancaId: z.string().min(1), versao: z.number().int().nonnegative(),
  valorDevidoProposto: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  motivo: z.string().trim().min(5).max(2000), evidenciaContratual: z.string().trim().min(5).max(2000),
}).strict()).max(1000);

