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
  // Exceção de preço (Issue #7): quando NÃO há preço de referência válido, a
  // matrícula só prossegue com uma JUSTIFICATIVA (texto) E papel autorizado
  // (apurado no servidor). NÃO há flag booleana livre do client — evita que
  // qualquer vendedor pule o bloqueio. `z.coerce.boolean` foi removido de
  // propósito: ele transformava "false" em true.
  // Obrigatória quando não há preço de referência ativo p/ a combinação país ×
  // produto (issue #22); a validação fica na ação, que conhece a matriz de preços.
  justificativaSemPreco: z.string().trim().optional(),
  // Comissão
  comissaoPct: z.coerce.number().min(0).max(100).default(20),
}).refine((d) => d.pagador === "ALUNO" || !!d.responsavelNome?.trim(), {
  message: "Informe o nome do responsável financeiro",
  path: ["responsavelNome"],
});
export type MatriculaInput = z.input<typeof MatriculaSchema>;

// ------------------------------------------------------------
// Ativação (regra de domínio do PO): ATIVAR EXIGE A TAXA QUITADA.
// Só existe UM caminho de ativação — "Receber pagamento e ativar":
//   - exige valor recebido, forma, data e comprovante (quando aplicável — só
//     DINHEIRO dispensa o comprovante);
//   - o valor é alocado à TAXA; se NÃO cobrir a taxa, a matrícula NÃO ativa
//     (fica AGUARDANDO). A 1ª mensalidade NÃO é exigida para ativar — é apenas
//     agendada (vencimento = início da 1ª aula + 30 dias).
// Não há mais "ativar sem pagamento": sem taxa paga não há ativação. Quem só
// quer registrar a matrícula usa "Salvar matrícula" (fica AGUARDANDO).
// ------------------------------------------------------------

/** Formas em que NÃO faz sentido exigir comprovante (recebimento em espécie). */
const FORMAS_SEM_COMPROVANTE: FormaPagamento[] = [FormaPagamento.DINHEIRO];

export const AtivacaoSchema = z
  .object({
    valorRecebido: z.coerce.number().positive("Informe o valor pago"),
    forma: z.nativeEnum(FormaPagamento).default(FormaPagamento.TRANSFERENCIA),
    dataPagamento: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : paraDataLocal(v)),
      z.coerce.date({ required_error: "Informe a data do pagamento" }),
    ),
    comprovanteUrl: z.string().optional(),
    comentario: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (!FORMAS_SEM_COMPROVANTE.includes(d.forma) && !d.comprovanteUrl?.trim()) {
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
