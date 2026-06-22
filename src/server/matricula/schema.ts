import { z } from "zod";
import { FormaPagamento, OrigemNivel, Genero } from "@prisma/client";
import { emailSchema, dataOpcional, paraDataLocal } from "@/server/_shared/validacao";

// Matrícula manual (ver docs/05, docs/09). Pré-preenchida pelo lead → confirmar + completar.
export const MatriculaSchema = z.object({
  leadId: z.string().optional(),
  // Aluno
  alunoNome: z.string().min(1, "Informe o nome do aluno"),
  alunoPaisId: z.string().min(1, "Selecione o país"),
  alunoDocumento: z.string().optional(),
  // telefone livre — normalizado p/ E.164 no servidor (doc 19 §4.3)
  alunoTelefone: z.string().optional(),
  alunoEmail: z.union([emailSchema, z.literal("")]).optional(),
  alunoGenero: z.nativeEnum(Genero).optional(),
  alunoNascimento: dataOpcional,
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
  diaVencimento: z.coerce.number().int().refine((d) => [5, 10, 15, 20, 25].includes(d), {
    message: "Dia de vencimento deve ser 5, 10, 15, 20 ou 25",
  }),
  // Contrato (valores negociados)
  taxaValor: z.coerce.number().min(0, "Valor inválido"),
  mensalidadeValor: z.coerce.number().min(0, "Valor inválido"),
  certificadoValor: z.coerce.number().min(0).optional().default(0), // só Costa Rica (doc 04)
  mesesPlano: z.coerce.number().int().positive().default(12),
  // Comissão
  comissaoPct: z.coerce.number().min(0).max(100).default(20),
}).refine((d) => d.pagador === "ALUNO" || !!d.responsavelNome?.trim(), {
  message: "Informe o nome do responsável financeiro",
  path: ["responsavelNome"],
});
export type MatriculaInput = z.input<typeof MatriculaSchema>;

// ------------------------------------------------------------
// Ativação (issue #23): dois caminhos EXPLÍCITOS e separados.
// - COM pagamento: exige valor recebido, forma, data e comprovante (quando
//   aplicável — só DINHEIRO dispensa o comprovante). O backend ainda valida se
//   o valor cobre as cobranças antes de marcá-las como pagas.
// - SEM pagamento: caminho próprio; a matrícula ativa com estado financeiro
//   PENDENTE (nada é presumido como pago). Exige justificativa.
// ------------------------------------------------------------

/** Formas em que NÃO faz sentido exigir comprovante (recebimento em espécie). */
const FORMAS_SEM_COMPROVANTE: FormaPagamento[] = [FormaPagamento.DINHEIRO];

// discriminatedUnion exige membros ZodObject "puros" (sem .refine, que vira
// ZodEffects). Por isso a regra do comprovante fica num .superRefine na união.
const AtivacaoComPagamentoSchema = z.object({
  comPagamento: z.literal(true),
  valorRecebido: z.coerce.number().positive("Informe o valor pago"),
  forma: z.nativeEnum(FormaPagamento).default(FormaPagamento.TRANSFERENCIA),
  dataPagamento: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : paraDataLocal(v)),
    z.coerce.date({ required_error: "Informe a data do pagamento" }),
  ),
  comprovanteUrl: z.string().optional(),
  comentario: z.string().optional(),
});

const AtivacaoSemPagamentoSchema = z.object({
  comPagamento: z.literal(false),
  /** Por que ativar sem lastro financeiro? Vira evento de auditoria. */
  motivo: z.string().min(1, "Informe o motivo da ativação sem pagamento"),
});

export const AtivacaoSchema = z
  .discriminatedUnion("comPagamento", [AtivacaoComPagamentoSchema, AtivacaoSemPagamentoSchema])
  .superRefine((d, ctx) => {
    if (
      d.comPagamento &&
      !FORMAS_SEM_COMPROVANTE.includes(d.forma) &&
      !d.comprovanteUrl?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o comprovante do pagamento",
        path: ["comprovanteUrl"],
      });
    }
  });
export type AtivacaoInput = z.input<typeof AtivacaoSchema>;
export type AtivacaoComPagamentoInput = z.input<typeof AtivacaoComPagamentoSchema>;
export type AtivacaoSemPagamentoInput = z.input<typeof AtivacaoSemPagamentoSchema>;
