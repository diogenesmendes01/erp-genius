import { z } from "zod";
import { OrigemCampoSchema } from "./campos";

export const AlcadaAditivoSchema = z.enum(["FINANCEIRA", "COMERCIAL", "PEDAGOGICA"]);
export type AlcadaAditivo = z.infer<typeof AlcadaAditivoSchema>;
const monetarios = new Set(["TAXA_VALOR", "MENSALIDADE_VALOR", "HORA_VALOR", "ADIANTAMENTO_VALOR"]);
const financeiros = new Set([...monetarios, "TAXA_VENCIMENTO", "PRIMEIRA_MENSALIDADE_VENCIMENTO", "COBERTURA_INICIO", "COBERTURA_FIM", "ADIANTAMENTO_VENCIMENTO", "ADIANTAMENTO_MINUTOS", "MOEDA"]);
const AlteracoesSchema = z.array(z.object({ campo: OrigemCampoSchema }).passthrough());
const AlteracoesProjetadasSchema = z.array(z.object({
  campo: OrigemCampoSchema, rotulo: z.string().trim().min(1), anterior: z.string().trim().min(1), novo: z.string().trim().min(1),
}).strict());

/** Alçadas aplicáveis aos fatos do snapshot; não aprova nem aplica condições. */
export function alcadasAplicaveisAditivo(alteracoes: unknown): AlcadaAditivo[] {
  const campos = AlteracoesSchema.parse(alteracoes).map(a => a.campo);
  const tem = (campos: readonly string[], conjunto: Set<string>) => campos.some(c => conjunto.has(c));
  return [
    ...(tem(campos, financeiros) || campos.includes("REGIME") ? ["FINANCEIRA" as const] : []),
    ...(tem(campos, monetarios) || campos.includes("MOEDA") || campos.includes("REGIME") ? ["COMERCIAL" as const] : []),
    ...(campos.includes("AGENDA_PARTICULAR") || campos.includes("REGIME") ? ["PEDAGOGICA" as const] : []),
  ];
}

export function camposDaAlcadaAditivo(alcada: AlcadaAditivo, alteracoes: unknown) {
  return AlteracoesProjetadasSchema.parse(alteracoes).filter(({ campo }) =>
    alcada === "FINANCEIRA" ? financeiros.has(campo) || campo === "REGIME"
      : alcada === "COMERCIAL" ? monetarios.has(campo) || campo === "MOEDA" || campo === "REGIME"
        : campo === "AGENDA_PARTICULAR" || campo === "REGIME");
}
