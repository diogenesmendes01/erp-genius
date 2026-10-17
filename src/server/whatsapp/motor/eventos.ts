import { z } from "zod";

export const EnvelopeMotorSchema = z.object({
  idEvento: z.string().uuid(),
  tipo: z.string().min(1),
  numeroId: z.string().min(1),
  ocorridoEm: z.number(),
  dados: z.unknown(),
});

export type EnvelopeMotor = z.infer<typeof EnvelopeMotorSchema>;

const PessoaMotorSchema = z.object({
  jid: z.string().optional(),
  telefoneE164: z.string().nullish(),
  nomePerfil: z.string().nullish(),
});

/** `dados` de `mensagem.recebida` (MODO-SERVICO.md §Eventos). */
export const DadosMensagemSchema = z.object({
  mensagemId: z.string().min(1),
  providerMessageId: z.string().min(1),
  chatJid: z.string().min(1),
  ehGrupo: z.boolean(),
  direcao: z.enum(["ENTRADA", "SAIDA"]).optional(),
  contato: PessoaMotorSchema.nullish(),
  participante: PessoaMotorSchema.nullish(),
  tipo: z.string().min(1),
  tipoMotor: z.string().nullish(),
  texto: z.string().nullish(),
  midia: z
    .object({
      mime: z.string().nullish(),
      nome: z.string().nullish(),
      tamanho: z.number().nullish(),
      ptt: z.boolean().nullish(),
      gif: z.boolean().nullish(),
    })
    .nullish(),
  citacaoMensagemId: z.string().nullish(),
  encaminhada: z.boolean().nullish(),
  localizacao: z.unknown().optional(),
  enquete: z.unknown().optional(),
  pagamento: z.unknown().optional(),
  quando: z.number(),
});

export type DadosMensagem = z.infer<typeof DadosMensagemSchema>;
