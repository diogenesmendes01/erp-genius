import { z } from "zod";
import { RecomposicaoCoberturaSchema } from "./recomposicao-cobertura";
export const EntradaRecomposicao = RecomposicaoCoberturaSchema.pick({ matriculaId: true, retornoOferta: true, inicioCompensacao: true, motivo: true, evidenciaCondicoes: true, periodosPropostos: true }).extend({
  alunoId: z.string().min(1), direitosIds: z.array(z.string().min(1)).min(1).max(3660),
}).strict();

