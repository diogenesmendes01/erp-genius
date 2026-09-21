import { z } from "zod";

// B2B — Fase 2 (doc 03): validação de Empresa, matrículas em LOTE e fatura única.

export const EmpresaSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome da empresa.").max(200),
  paisId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
  documento: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : null)),
  contatoNome: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : null)),
  contatoEmail: z
    .string()
    .trim()
    .email("E-mail inválido.")
    .max(200)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  contatoTelefone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? v : null)),
  diaVencimento: z.number().int().min(1).max(28).default(10),
  observacoes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v ? v : null)),
  ativo: z.boolean().default(true),
});
export type EmpresaInput = z.input<typeof EmpresaSchema>;

export const ColaboradorLoteSchema = z.object({
  primeiroNome: z.string().trim().min(1, "Nome do colaborador obrigatório.").max(80),
  sobrenome: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : null)),
  email: z
    .string()
    .trim()
    .email("E-mail inválido.")
    .max(200)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  telefone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? v : null)),
});

export const MatriculasLoteB2BSchema = z.object({
  empresaId: z.string().min(1),
  produtoId: z.string().min(1),
  mensalidadeValor: z.number().positive("Mensalidade precisa ser maior que zero."),
  mesesPlano: z.number().int().min(1).max(36).default(12),
  colaboradores: z.array(ColaboradorLoteSchema).min(1, "Inclua ao menos um colaborador.").max(200),
});
export type MatriculasLoteB2BInput = z.input<typeof MatriculasLoteB2BSchema>;

export const FecharFaturaSchema = z.object({
  empresaId: z.string().min(1),
  /** "YYYY-MM" da competência a faturar. */
  competencia: z.string().regex(/^\d{4}-\d{2}$/, "Competência no formato AAAA-MM."),
});
export type FecharFaturaInput = z.input<typeof FecharFaturaSchema>;
