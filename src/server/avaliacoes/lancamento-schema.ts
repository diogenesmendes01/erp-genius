import { z } from "zod";
import { HABILIDADES } from "./calculo";
export const NotasLancamentoSchema = z.array(z.object({
  habilidade: z.enum(HABILIDADES), nota: z.string().max(100).regex(/^-?\d+(\.\d+)?$/).nullable(),
  comentarioAluno: z.string().trim().max(2000),
}).strict()).min(1).max(4).superRefine((ns, ctx) => {
  if (new Set(ns.map(n => n.habilidade)).size !== ns.length) ctx.addIssue({ code: "custom", message: "Habilidade repetida." });
});
const id = z.string().min(1).max(100);
export const SalvarLancamentoSchema = z.object({
  alocacaoId: id, codigoAvaliacao: id, realizadaEm: z.string().datetime({ offset: true }),
  notas: NotasLancamentoSchema, submetida: z.boolean(), versaoEsperada: z.number().int().min(0).max(2147483646),
  chaveIdempotencia: z.string().min(8).max(100),
  realizadaPorId: id.optional(), motivoRegularizacao: z.string().trim().min(5).max(2000).optional(),
  evidenciasRegularizacao: z.string().trim().min(5).max(4000).optional(),
}).strict();
export const OficializarLancamentoSchema = z.object({
  lancamentoId: id, conteudoHash: z.string().regex(/^[a-f0-9]{64}$/), aprovada: z.boolean(),
  motivo: z.string().trim().min(5).max(2000),
}).strict();
