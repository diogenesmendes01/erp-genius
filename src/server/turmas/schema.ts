import { z } from "zod";
import { dataOpcional } from "@/server/_shared/validacao";

// Turma = modalidade × nível × dias/horário × data de início (cohort online). Ver docs/06, docs/09.
export const TurmaSchema = z.object({
  modalidadeId: z.string().min(1, "Selecione a modalidade"),
  nivelId: z.string().min(1, "Selecione o nível"),
  professorId: z.string().optional(),
  diasHorario: z.string().min(1, "Informe os dias/horário (ex.: Ter/Qui 20h)"),
  dataInicio: dataOpcional,
  capacidade: z.coerce.number().int().positive("Capacidade deve ser ≥ 1").default(12),
  rolling: z.boolean().optional().default(false),
});

export type TurmaInput = z.input<typeof TurmaSchema>;
