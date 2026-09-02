import { z } from "zod";

// ACADÊMICO — Fase 3 (doc 03): validação de diário (aula/frequência), avaliações/notas,
// teste de nível, progressão e acesso ao portal.

// Data SEM horário, estrita (review PR #60 rodada 2): aceitar qualquer string deixava
// "2026-08-20T09:00" e "...T10:00" criarem DUAS aulas do mesmo dia (timestamps distintos
// furam o upsert por turma×data) — e "2026-02-31" passava. Formato + calendário validados.
const DATA_SO_DIA = /^\d{4}-\d{2}-\d{2}$/;
function diaDeCalendarioValido(s: string): boolean {
  const [ano, mes, dia] = s.split("-").map(Number);
  const d = new Date(ano, mes - 1, dia);
  return d.getFullYear() === ano && d.getMonth() === mes - 1 && d.getDate() === dia;
}

export const RegistrarAulaSchema = z.object({
  turmaId: z.string().min(1),
  dataISO: z
    .string()
    .regex(DATA_SO_DIA, "Informe a data da aula no formato AAAA-MM-DD (sem horário).")
    .refine(diaDeCalendarioValido, "Data da aula inválida."),
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
    .transform((v) => (v ? v : null))
    // Mesma regra estrita da aula (review PR #60 rodada 2), preservando o opcional/vazio.
    .refine((v) => v === null || (DATA_SO_DIA.test(v) && diaDeCalendarioValido(v)), {
      message: "Informe a data no formato AAAA-MM-DD (sem horário).",
    }),
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
