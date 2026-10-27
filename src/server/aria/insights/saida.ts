import { z } from "zod";

const texto = z.string().min(1).max(500).refine((v) => v.trim().length > 0);
const sugestao = z.string().min(1).max(4000).refine((v) => v.trim().length > 0);
export const InsightSchema = z.object({
  temperatura: z.enum(["FRIO", "MORNO", "QUENTE"]).nullable(),
  chanceFechar: z.number().finite().min(0).max(100).nullable(),
  sentimento: z.enum(["POSITIVO", "NEUTRO", "NEGATIVO"]).nullable(),
  melhorHorario: texto.nullable(),
  intencao: texto.nullable(),
  sinais: z.array(texto).max(8),
  riscos: z.array(texto).max(8),
  proximoPasso: texto.nullable(),
  textoSugerido: sugestao.nullable(),
}).strict();

export type AnaliseInsight = z.infer<typeof InsightSchema>;

export function normalizarInsight(valor: unknown): AnaliseInsight | null {
  let entrada = valor;
  if (typeof valor === "string") {
    try { entrada = JSON.parse(valor); } catch { return null; }
  }
  const resultado = InsightSchema.safeParse(entrada);
  return resultado.success ? resultado.data : null;
}

const textoJson = (maxLength: number) => ({ type: ["string", "null"], minLength: 1, maxLength, pattern: "\\S" });
export const ESQUEMA_INSIGHT: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["temperatura", "chanceFechar", "sentimento", "melhorHorario", "intencao", "sinais", "riscos", "proximoPasso", "textoSugerido"],
  properties: {
    temperatura: { type: ["string", "null"], enum: ["FRIO", "MORNO", "QUENTE", null] },
    chanceFechar: { type: ["number", "null"], minimum: 0, maximum: 100 },
    sentimento: { type: ["string", "null"], enum: ["POSITIVO", "NEUTRO", "NEGATIVO", null] },
    melhorHorario: textoJson(500),
    intencao: textoJson(500),
    sinais: { type: "array", maxItems: 8, items: { type: "string", minLength: 1, maxLength: 500, pattern: "\\S" } },
    riscos: { type: "array", maxItems: 8, items: { type: "string", minLength: 1, maxLength: 500, pattern: "\\S" } },
    proximoPasso: textoJson(500),
    textoSugerido: textoJson(4000),
  },
};
