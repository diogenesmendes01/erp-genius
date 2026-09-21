import { z } from "zod";
import { PeriodoFechamentoHorasSchema } from "./fechamento-horas-periodo";
export const PreparacaoFechamentoHorasSchema = z.object({ alunoId: z.string().min(1), matriculaId: z.string().min(1), documentoId: z.string().min(1),
  periodo: PeriodoFechamentoHorasSchema, escolha: z.enum(["AGUARDAR", "PROPOR_PARCIAL"]), versaoAnterior: z.number().int().nonnegative(),
  motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict();
