import { z } from "zod";
const valor = z.string().regex(/^\d+(?:\.\d{1,2})?$/);
const clausula = { clausulaId: z.string().trim().min(1), condicoesAplicacao: z.string().trim().min(1) };
export const RegraAcertoDesistenciaPreparacaoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("VALOR_FIXO"), ...clausula, valor }).strict(),
  z.object({ tipo: z.literal("PERCENTUAL_VALOR_NEGOCIADO"), ...clausula, percentual: valor }).strict(),
]);
export const RegrasEncerramentoSchema = z.object({
  diaEncerramento: z.enum(["INCLUIR", "EXCLUIR"]),
  metodoDesconto: z.enum(["ANTES_DO_PROPORCIONAL", "DEPOIS_DO_PROPORCIONAL"]),
  condicoesDescontos: z.string().trim().min(1),
  multa: z.discriminatedUnion("tipo", [
    z.object({ tipo: z.literal("SEM_PREVISAO"), motivo: z.string().trim().min(1) }).strict(),
    z.object({ tipo: z.literal("VALOR_FIXO"), ...clausula, valor }).strict(),
    z.object({ tipo: z.literal("PERCENTUAL"), ...clausula, percentual: valor, descricaoBase: z.string().trim().min(1) }).strict(),
  ]),
  // Ausente nas versões históricas: Q165 deve tratá-las como pendência, nunca
  // inferir uma retenção, devolução ou proporcionalidade.
  acertoDesistenciaPreparacao: RegraAcertoDesistenciaPreparacaoSchema.optional(),
}).strict();
