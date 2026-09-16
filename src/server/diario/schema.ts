import { z } from "zod";

export const DiarioSchema = z.object({
  aulaId: z.string().min(1).optional(),
  encontroId: z.string().min(1).optional(),
  estadoAnterior: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  turmaId: z.string().min(1, "Selecione a turma"),
  ocorridaEm: z.string().datetime({ offset: true }),
  conteudo: z.string().trim().min(1, "Informe o conteúdo ministrado").max(10000),
  registros: z.array(z.object({
    alunoId: z.string().min(1),
    presente: z.boolean().nullable(),
    participacao: z.enum(["PRESENTE", "FALTA", "IMPEDIDO_POR_RESTRICAO"]).optional(),
    observacao: z.string().trim().max(2000).optional(),
  }).refine(r => !r.participacao || (r.participacao === "PRESENTE" ? r.presente === true : r.presente === false), "Participação incompatível com a presença")
    .refine(r => r.participacao !== "IMPEDIDO_POR_RESTRICAO" || !!r.observacao?.trim(), "Registre a ocorrência do impedimento, sem dados financeiros"))
    .min(1, "Inclua ao menos um aluno").max(200),
}).refine((d) => new Set(d.registros.map((r) => r.alunoId)).size === d.registros.length, "Aluno duplicado no diário");
export type DiarioInput = z.input<typeof DiarioSchema>;
