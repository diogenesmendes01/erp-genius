import { z } from "zod";
import { dataOpcional } from "@/server/_shared/validacao";

// Turma = modalidade × nível × dias/horário × data de início (cohort online). Ver docs/06, docs/09.
export const TurmaSchema = z.object({
  modalidadeId: z.string().min(1, "Selecione a modalidade"),
  nivelId: z.string().min(1, "Selecione o nível"),
  professorId: z.string().optional(),
  // diasHorario é OPCIONAL no domínio (alinhado ao Prisma/banco): turmas podem
  // entrar "a definir" (carga Q10, doc 20). Vazio → undefined; persistido como null.
  diasHorario: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().optional(),
  ),
  dataInicio: dataOpcional,
  capacidade: z.coerce.number().int().positive("Capacidade deve ser ≥ 1").default(12),
  rolling: z.boolean().optional().default(false),
});

export type TurmaInput = z.input<typeof TurmaSchema>;
