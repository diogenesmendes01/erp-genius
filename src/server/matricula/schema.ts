import { z } from "zod";
import { FormaPagamento, OrigemNivel, Genero } from "@prisma/client";
import { emailSchema, dataOpcional } from "@/server/_shared/validacao";

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
  justificativaSemPreco: z.string().trim().optional(),
  // Comissão
  comissaoPct: z.coerce.number().min(0).max(100).default(20),
}).refine((d) => d.pagador === "ALUNO" || !!d.responsavelNome?.trim(), {
  message: "Informe o nome do responsável financeiro",
  path: ["responsavelNome"],
});
export type MatriculaInput = z.input<typeof MatriculaSchema>;

export const AtivacaoSchema = z.object({
  forma: z.nativeEnum(FormaPagamento).default(FormaPagamento.TRANSFERENCIA),
});
export type AtivacaoInput = z.input<typeof AtivacaoSchema>;
