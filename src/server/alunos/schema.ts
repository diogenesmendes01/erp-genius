import { z } from "zod";
import { Genero } from "@prisma/client";
import { emailSchema, dataOpcional } from "@/server/_shared/validacao";

// Movimentações do aluno (ver docs/09 §Alunos). Motivos de encerramento = lista fechada.
export const MOTIVOS_ENCERRAMENTO = [
  "Concluiu",
  "Desistiu",
  "Mudou de país",
  "Inadimplência",
  "Transferência",
  "Outro",
] as const;

export const PausarSchema = z.object({
  motivo: z.string().min(1, "Informe o motivo da pausa"),
  dataRetornoPrevista: dataOpcional,
});
export type PausarInput = z.input<typeof PausarSchema>;

export const EncerrarSchema = z
  .object({
    motivo: z.enum(MOTIVOS_ENCERRAMENTO),
    observacao: z.string().optional(),
  })
  .refine((d) => d.motivo !== "Outro" || !!d.observacao?.trim(), {
    message: "Observação obrigatória quando o motivo é Outro",
    path: ["observacao"],
  });
export type EncerrarInput = z.input<typeof EncerrarSchema>;

export const TrocarTurmaSchema = z.object({
  turmaDestinoId: z.string().min(1, "Selecione a turma de destino"),
  justificativa: z.string().optional(),
});
export type TrocarTurmaInput = z.input<typeof TrocarTurmaSchema>;

// Edição de dados cadastrais do aluno (telefone normalizado no servidor).
// Toda edição exige MOTIVO (auditoria) — registrado no Evento junto com o autor.
export const EditarAlunoSchema = z.object({
  nome: z.string().min(1, "Informe o nome"),
  paisId: z.string().min(1, "Selecione o país"),
  documento: z.string().optional(),
  telefone: z.string().optional(),
  email: z.union([emailSchema, z.literal("")]).optional(),
  genero: z.nativeEnum(Genero).optional(),
  nascimento: dataOpcional,
  motivo: z.string().min(1, "Informe o motivo da edição"),
});
export type EditarAlunoInput = z.input<typeof EditarAlunoSchema>;
