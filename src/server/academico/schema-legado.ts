import { z } from "zod";

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
