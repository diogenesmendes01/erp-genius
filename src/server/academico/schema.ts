import { z } from "zod";

// ACADÊMICO — Fase 3 (doc 03): validação de diário (aula/frequência), avaliações/notas,
// teste de nível, progressão e acesso ao portal.

export const RegistrarAulaSchema = z.object({
  turmaId: z.string().min(1),
  dataISO: z.string().min(4, "Informe a data da aula."),
  conteudo: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v ? v : null)),
  presencas: z
    .array(z.object({ alunoId: z.string().min(1), presente: z.boolean() }))
    .min(1, "Registre a presença de ao menos um aluno."),
});
export type RegistrarAulaInput = z.input<typeof RegistrarAulaSchema>;

export const AvaliacaoSchema = z.object({
  turmaId: z.string().min(1),
  nome: z.string().trim().min(1, "Dê um nome à avaliação.").max(80),
  peso: z.number().positive().max(10).default(1),
  dataISO: z
    .string()
    .optional()
    .transform((v) => (v ? v : null)),
});
export type AvaliacaoInput = z.input<typeof AvaliacaoSchema>;

export const LancarNotasSchema = z.object({
  avaliacaoId: z.string().min(1),
  notas: z
    .array(
      z.object({
        alunoId: z.string().min(1),
        valor: z.number().min(0, "Nota mínima 0.").max(100, "Nota máxima 100."),
      }),
    )
    .min(1, "Lance ao menos uma nota."),
});
export type LancarNotasInput = z.input<typeof LancarNotasSchema>;

export const TesteNivelSchema = z.object({
  alunoId: z.string().min(1),
  nivelId: z.string().min(1, "Escolha o nível resultante."),
  pontuacao: z.number().min(0).max(100).optional(),
  observacao: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v ? v : null)),
});
export type TesteNivelInput = z.input<typeof TesteNivelSchema>;

export const CriarAcessoPortalSchema = z.object({
  alunoId: z.string().min(1),
  email: z.string().trim().email("E-mail inválido.").max(200),
  senha: z.string().min(8, "Senha com pelo menos 8 caracteres."),
});
export type CriarAcessoPortalInput = z.input<typeof CriarAcessoPortalSchema>;
