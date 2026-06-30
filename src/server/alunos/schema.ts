import { z } from "zod";
import { Genero, Escolaridade } from "@prisma/client";
import { emailSchema, dataOpcional, codigoISOOpcional } from "@/server/_shared/validacao";

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
// Edição é LENIENTE (só identidade obrigatória): os 190 alunos legados podem não ter
// documento/nascimento/etc. e a Secretaria precisa conseguir editá-los assim mesmo.
export const EditarAlunoSchema = z.object({
  // Identificação
  primeiroNome: z.string().min(1, "Informe o nome"),
  sobrenome: z.string().min(1, "Informe o sobrenome"),
  nomePreferido: z.string().optional(),
  nascimento: dataOpcional,
  genero: z.nativeEnum(Genero).optional(),
  // Documentação
  paisId: z.string().min(1, "Selecione o país"),
  tipoDocumentoId: z.string().optional(),
  documento: z.string().optional(),
  documentoPaisEmissor: codigoISOOpcional,
  nacionalidade: codigoISOOpcional,
  segundaNacionalidade: codigoISOOpcional,
  // Contato
  email: z.union([emailSchema, z.literal("")]).optional(),
  telefone: z.string().optional(),
  whatsapp: z.boolean().optional(),
  aceitaComunicacoes: z.boolean().optional(),
  // Residência
  paisResidencia: codigoISOOpcional,
  cep: z.string().optional(),
  rua: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  regiao: z.string().optional(),
  // Acadêmico
  escolaridade: z.nativeEnum(Escolaridade).optional(),
  idiomaNativo: z.string().optional(),
  // Operacional
  fuso: z.string().optional(),
  observacoes: z.string().optional(),
  // Auditoria
  motivo: z.string().min(1, "Informe o motivo da edição"),
});
export type EditarAlunoInput = z.input<typeof EditarAlunoSchema>;
