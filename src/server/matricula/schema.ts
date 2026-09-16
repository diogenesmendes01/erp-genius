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
} from "@/server/_shared/validacao";

// Matrícula manual (ver docs/05, docs/09). Pré-preenchida pelo lead → confirmar + completar.
// Cadastro completo do aluno (doc 09): essenciais OBRIGATÓRIOS; resto opcional.
export const MatriculaSchema = z.object({
  leadId: z.string().optional(),

  // Aluno — Identificação (doc 09)
  alunoPrimeiroNome: z.string().min(1, "Informe o nome do aluno"),
  alunoSobrenome: z.string().min(1, "Informe o sobrenome"),
  alunoNomePreferido: z.string().optional(),
  alunoNascimento: dataObrigatoria,
  alunoGenero: z.nativeEnum(Genero),

  // Aluno — Documentação (país dirige o tipo — doc 04)
  alunoPaisId: z.string().min(1, "Selecione o país"),
  alunoTipoDocumentoId: z.string().min(1, "Selecione o tipo de documento"),
  alunoDocumento: z.string().min(1, "Informe o número do documento"),
  alunoDocumentoPaisEmissor: codigoISOOpcional,
  alunoNacionalidade: codigoISO,
  alunoSegundaNacionalidade: codigoISOOpcional,

  // Aluno — Contato (telefone/e-mail são obrigatórios aqui — doc 04 bloqueia inválidos)
  alunoEmail: emailSchema,
  // telefone livre — normalizado p/ E.164 no servidor (doc 19 §4.3)
  alunoTelefone: z.string().min(1, "Informe o telefone"),
  alunoWhatsapp: z.boolean().default(false),
  alunoAceitaComunicacoes: z.boolean().default(true),

  // Aluno — Residência (pode diferir da nacionalidade — doc 04)
  alunoPaisResidencia: codigoISO,
  alunoCep: z.string().optional(),
  alunoRua: z.string().optional(),
  alunoNumero: z.string().optional(),
  alunoComplemento: z.string().optional(),
  alunoBairro: z.string().optional(),
  alunoCidade: z.string().optional(),
  alunoRegiao: z.string().optional(),

  // Aluno — Acadêmico
  alunoEscolaridade: z.nativeEnum(Escolaridade).optional(),
  alunoIdiomaNativo: z.string().optional(),

  // Aluno — Operacional
  alunoFuso: z.string().optional(),
  alunoObservacoes: z.string().optional(),

  // Aluno — Contato de emergência (opcional — gravado como Responsavel EMERGENCIA)
  emergenciaNome: z.string().optional(),
  emergenciaParentesco: z.string().optional(),
  emergenciaTelefone: z.string().optional(),

  // Responsável financeiro (o pagador): próprio aluno / responsável (Kids/Teens) / empresa (B2B)
  pagador: z.enum(["ALUNO", "RESPONSAVEL", "EMPRESA"]).default("ALUNO"),
  responsavelNome: z.string().optional(),
  responsavelParentesco: z.string().optional(),
  responsavelTelefone: z.string().optional(),
  responsavelEmail: z.string().optional(),
  // Curso & alocação
  produtoId: z.string().min(1, "Selecione o produto"),
  turmaId: z.string().optional(),
  nivelInicialId: z.string().optional(),
  origemNivel: z.nativeEnum(OrigemNivel).optional(),
  dataAvaliacaoNivel: dataOpcional,
  diaVencimento: z.coerce.number().int().min(1).max(31),
  // Contrato (valores negociados)
  taxaValor: z.coerce.number().min(0, "Valor inválido"),
  mensalidadeValor: z.coerce.number().min(0, "Valor inválido"),
  certificadoValor: z.coerce.number().min(0).optional().default(0), // só Costa Rica (doc 04)
  mesesPlano: z.coerce.number().int().positive().default(12),
  cobertura: CoberturaInicialSchema,
  primeiroVencimento: DataCivilSchema,
  // Exceção de preço (Issue #7): quando NÃO há preço de referência válido, a
  // matrícula só prossegue com uma JUSTIFICATIVA (texto) E papel autorizado
  // (apurado no servidor). NÃO há flag booleana livre do client — evita que
  // qualquer vendedor pule o bloqueio. `z.coerce.boolean` foi removido de
  // propósito: ele transformava "false" em true.
  // Obrigatória quando não há preço de referência ativo p/ a combinação país ×
  // produto (issue #22); a validação fica na ação, que conhece a matriz de preços.
  justificativaSemPreco: z.string().trim().optional(),
  // Comissão
  comissaoPct: z.never().optional(), // calculada no servidor pela política vigente
}).refine((d) => !d.cobertura || !!d.primeiroVencimento, {
  message: "Informe o vencimento acordado da primeira mensalidade.", path: ["primeiroVencimento"],
}).refine((d) => d.pagador === "ALUNO" || !!d.responsavelNome?.trim(), {
  message: "Informe o nome do responsável financeiro",
  path: ["responsavelNome"],
});
export type MatriculaInput = z.input<typeof MatriculaSchema>;

// Ativação com recebimento novo, ou valor zero quando já existe quitação.
// O servidor preserva os pagamentos anteriores e autoriza caixa separadamente.
// Evidência de contrato não é inferida do preenchimento deste formulário.

/** Formas em que NÃO faz sentido exigir comprovante (recebimento em espécie). */
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
    if (d.valorRecebido > 0 && !FORMAS_SEM_COMPROVANTE.includes(d.forma) && !d.comprovanteUrl?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o comprovante do pagamento",
        path: ["comprovanteUrl"],
      });
    }
  });
export type AtivacaoInput = z.input<typeof AtivacaoSchema>;

// Criar + ativar atômico (issue #8): combina os dados da matrícula com a forma
// de pagamento da ativação. Exige os papéis de criar E ativar.
export const MatriculaComAtivacaoSchema = z.object({
  matricula: MatriculaSchema,
  ativacao: AtivacaoSchema,
});
export type MatriculaComAtivacaoInput = {
  matricula: MatriculaInput;
  ativacao: AtivacaoInput;
};
