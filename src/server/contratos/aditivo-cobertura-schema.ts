import { z } from "zod";
import { DataCivilSchema } from "@/server/matricula/cobertura";

const id = z.string().trim().min(1).max(100);
const texto = z.string().trim().min(5).max(4000);
const data = DataCivilSchema;
export const LinhaImpactoCoberturaAditivoSchema = z.object({
  cobrancaId: id,
  classificacao: z.enum(["AFETADA", "PRESERVADA"]),
  coberturaInicioNova: data.optional(),
  coberturaFimNova: data.optional(),
  justificativa: texto,
}).strict().superRefine((linha, ctx) => {
  if (linha.classificacao === "AFETADA" && (!linha.coberturaInicioNova || !linha.coberturaFimNova)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Mensalidade afetada exige os dois limites novos." });
  if (linha.classificacao === "AFETADA" && linha.coberturaInicioNova && linha.coberturaFimNova && linha.coberturaInicioNova > linha.coberturaFimNova) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "O início não pode suceder o fim da cobertura." });
  if (linha.classificacao === "PRESERVADA" && (linha.coberturaInicioNova || linha.coberturaFimNova)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Mensalidade preservada não recebe nova cobertura." });
});
export const PrepararImpactosCoberturaAditivoSchema = z.object({ matriculaId: id, propostaId: id, conclusaoId: id, revisaoHash: z.string().regex(/^[a-f0-9]{64}$/), linhas: z.array(LinhaImpactoCoberturaAditivoSchema).min(1).max(1000), motivo: texto, evidencia: texto, chaveIdempotencia: z.string().trim().min(8).max(200) }).strict();
export const DecidirImpactosCoberturaAditivoSchema = z.object({ conjuntoId: id, aprovada: z.boolean(), motivo: texto, chaveIdempotencia: z.string().trim().min(8).max(200) }).strict();
export const AplicarImpactosCoberturaAditivoSchema = z.object({ conjuntoId: id, chaveIdempotencia: z.string().trim().min(8).max(200) }).strict();
export const ObsoletarImpactosCoberturaAditivoSchema = z.object({ conjuntoId: id, motivo: texto, chaveIdempotencia: z.string().trim().min(8).max(200) }).strict();
