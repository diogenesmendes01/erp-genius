import { z } from "zod";
import { Genero, Escolaridade } from "@prisma/client";
import { emailSchema, dataOpcional, codigoISOOpcional } from "@/server/_shared/validacao";
import { HorarioCompativelSchema } from "@/server/academico/schema";

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
  matriculaId: z.string().min(1).optional(),
  alocacaoOrigemId: z.string().min(1).optional(),
  turmaDestinoId: z.string().min(1, "Selecione a turma de destino"),
  justificativa: z.string().optional(),
  horarioCompativel: HorarioCompativelSchema,
});
export type TrocarTurmaInput = z.input<typeof TrocarTurmaSchema>;

export const EditarAlunoSchema = z.object({
  primeiroNome: z.string().min(1, "Informe o nome"),
  sobrenome: z.string().min(1, "Informe o sobrenome"),
  nomePreferido: z.string().optional(),
  nascimento: dataOpcional,
  genero: z.nativeEnum(Genero).optional(),
  paisId: z.string().min(1, "Selecione o país"),
  tipoDocumentoId: z.string().optional(),
  documento: z.string().optional(),
  documentoPaisEmissor: codigoISOOpcional,
  nacionalidade: codigoISOOpcional,
  segundaNacionalidade: codigoISOOpcional,
  email: z.union([emailSchema, z.literal("")]).optional(),
  telefone: z.string().optional(),
  whatsapp: z.boolean().optional(),
  aceitaComunicacoes: z.boolean().optional(),
  paisResidencia: codigoISOOpcional,
  cep: z.string().optional(),
  rua: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  regiao: z.string().optional(),
  escolaridade: z.nativeEnum(Escolaridade).optional(),
  idiomaNativo: z.string().optional(),
  fuso: z.string().optional(),
  observacoes: z.string().optional(),
  motivo: z.string().min(1, "Informe o motivo da edição"),
});
export type EditarAlunoInput = z.input<typeof EditarAlunoSchema>;
