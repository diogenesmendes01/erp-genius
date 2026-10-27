import { z } from "zod";
import { FormaPagamento, OrigemNivel, Genero, Escolaridade } from "@prisma/client";
import { CoberturaInicialSchema, DataCivilSchema } from "./cobertura";
import {
  emailSchema,
  dataOpcional,
  dataObrigatoria,
  codigoISO,
  codigoISOOpcional,
  paraDataLocal,
  ChaveIdempotenciaSchema,
} from "@/server/_shared/validacao";

export const MatriculaSchema = z.object({
  leadId: z.string().optional(),

  alunoPrimeiroNome: z.string().min(1, "Informe o nome do aluno"),
  alunoSobrenome: z.string().min(1, "Informe o sobrenome"),
  alunoNomePreferido: z.string().optional(),
  alunoNascimento: dataObrigatoria,
  alunoGenero: z.nativeEnum(Genero),

  alunoPaisId: z.string().min(1, "Selecione o país"),
  alunoTipoDocumentoId: z.string().min(1, "Selecione o tipo de documento"),
  alunoDocumento: z.string().min(1, "Informe o número do documento"),
  alunoDocumentoPaisEmissor: codigoISOOpcional,
  alunoNacionalidade: codigoISO,
  alunoSegundaNacionalidade: codigoISOOpcional,

  alunoEmail: emailSchema,
  alunoTelefone: z.string().min(1, "Informe o telefone"),
  alunoWhatsapp: z.boolean().default(false),
  alunoAceitaComunicacoes: z.boolean().default(true),

  alunoPaisResidencia: codigoISO,
  alunoCep: z.string().optional(),
  alunoRua: z.string().optional(),
  alunoNumero: z.string().optional(),
  alunoComplemento: z.string().optional(),
  alunoBairro: z.string().optional(),
  alunoCidade: z.string().optional(),
  alunoRegiao: z.string().optional(),

  alunoEscolaridade: z.nativeEnum(Escolaridade).optional(),
  alunoIdiomaNativo: z.string().optional(),

  alunoFuso: z.string().optional(),
  alunoObservacoes: z.string().optional(),

  emergenciaNome: z.string().optional(),
  emergenciaParentesco: z.string().optional(),
  emergenciaTelefone: z.string().optional(),

  pagador: z.enum(["ALUNO", "RESPONSAVEL", "EMPRESA"]).default("ALUNO"),
  responsavelNome: z.string().optional(),
  responsavelParentesco: z.string().optional(),
  responsavelTelefone: z.string().optional(),
  responsavelEmail: z.string().optional(),
  produtoId: z.string().min(1, "Selecione o produto"),
  turmaId: z.string().optional(),
  nivelInicialId: z.string().optional(),
  origemNivel: z.nativeEnum(OrigemNivel).optional(),
  dataAvaliacaoNivel: dataOpcional,
  diaVencimento: z.coerce.number().int().min(1).max(31),
  taxaValor: z.coerce.number().min(0, "Valor inválido"),
  mensalidadeValor: z.coerce.number().min(0, "Valor inválido"),
  certificadoValor: z.coerce.number().min(0).optional().default(0),
  mesesPlano: z.coerce.number().int().positive().default(12),
  cobertura: CoberturaInicialSchema,
  primeiroVencimento: DataCivilSchema,
  justificativaSemPreco: z.string().trim().optional(),
  comissaoPct: z.never().optional(),
  chaveIdempotencia: ChaveIdempotenciaSchema.optional(),
}).refine((d) => !d.cobertura || !!d.primeiroVencimento, {
  message: "Informe o vencimento acordado da primeira mensalidade.", path: ["primeiroVencimento"],
}).refine((d) => d.pagador === "ALUNO" || !!d.responsavelNome?.trim(), {
  message: "Informe o nome do responsável financeiro",
  path: ["responsavelNome"],
});
export type MatriculaInput = z.input<typeof MatriculaSchema>;

const FORMAS_SEM_COMPROVANTE: FormaPagamento[] = [FormaPagamento.DINHEIRO];

export const AtivacaoSchema = z
  .object({
    valorRecebido: z.coerce.number().min(0, "Valor inválido").finite(),
    forma: z.nativeEnum(FormaPagamento).default(FormaPagamento.TRANSFERENCIA),
    dataPagamento: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : paraDataLocal(v)),
      z.coerce.date({ required_error: "Informe a data do pagamento" }),
    ),
    comprovanteUrl: z.string().optional(),
    comentario: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.valorRecebido > 0 && (d.comentario?.trim().length ?? 0) < 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe a evidência da destinação do recebimento (mínimo de 5 caracteres)",
        path: ["comentario"],
      });
    }
    if (d.valorRecebido > 0 && !FORMAS_SEM_COMPROVANTE.includes(d.forma) && !d.comprovanteUrl?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o comprovante do pagamento",
        path: ["comprovanteUrl"],
      });
    }
  });
export type AtivacaoInput = z.input<typeof AtivacaoSchema>;

export const MatriculaComAtivacaoSchema = z.object({
  matricula: MatriculaSchema,
  ativacao: AtivacaoSchema,
});
export type MatriculaComAtivacaoInput = {
  matricula: MatriculaInput;
  ativacao: AtivacaoInput;
};
