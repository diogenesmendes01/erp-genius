import { z } from "zod";
import { DataCivilSchema } from "./cobertura";

const vencimentos = z.discriminatedUnion("opcao", [
  z.object({ opcao: z.literal("MANTER_VENCIMENTOS") }).strict(),
  z.object({ opcao: z.literal("REPROGRAMAR_PARCELAS"), datas: z.array(z.object({
    cobrancaId: z.string().trim().min(1), vencimento: DataCivilSchema,
  }).strict()).max(1000) }).strict(),
]);
export const PreviaRetomadaMatriculasSchema = z.object({
  retorno: DataCivilSchema,
  matriculas: z.array(z.object({ matriculaId: z.string().trim().min(1), vencimentos }).strict())
    .min(1).max(100).refine((itens) => new Set(itens.map((i) => i.matriculaId)).size === itens.length, "Não repita matrículas."),
}).strict();
export type PreviaRetomadaMatriculasInput = z.input<typeof PreviaRetomadaMatriculasSchema>;
export const SolicitarRetomadaMatriculasSchema = PreviaRetomadaMatriculasSchema.extend({
  motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().trim().min(8).max(100),
});
export type SolicitarRetomadaMatriculasInput = z.input<typeof SolicitarRetomadaMatriculasSchema>;
