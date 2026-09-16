import { z } from "zod";
import type { StatusMudancaAcademica } from "@prisma/client";

const motivo = z.string().trim().min(5, "Informe uma justificativa com pelo menos 5 caracteres.").max(2000);
export const HorarioCompativelSchema = z.literal(true, {
  errorMap: () => ({ message: "Confirme com o aluno a compatibilidade do horário da turma de destino." }),
});

export const SolicitarMudancaAcademicaSchema = z.object({
  matriculaId: z.string().min(1).optional(),
  alocacaoOrigemId: z.string().min(1).optional(),
  turmaDestinoId: z.string().trim().min(1, "Selecione a turma de destino."),
  motivo,
  horarioCompativel: HorarioCompativelSchema,
});
export type SolicitarMudancaAcademicaInput = z.input<typeof SolicitarMudancaAcademicaSchema>;

export const RegistrarParecerMudancaSchema = z.object({ conteudo: motivo });
export type RegistrarParecerMudancaInput = z.input<typeof RegistrarParecerMudancaSchema>;

export const DecidirMudancaAcademicaSchema = z.object({
  aprovar: z.boolean(),
  motivo,
  justificativaDispensaParecer: z.string().trim().max(2000).optional(),
}).superRefine((dados, ctx) => {
  if (dados.justificativaDispensaParecer && dados.justificativaDispensaParecer.length < 5) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["justificativaDispensaParecer"], message: "Justifique a indisponibilidade do parecer com pelo menos 5 caracteres." });
  }
  if (!dados.aprovar && dados.justificativaDispensaParecer) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["justificativaDispensaParecer"], message: "A rejeição não precisa dispensar parecer." });
  }
});
export type DecidirMudancaAcademicaInput = z.input<typeof DecidirMudancaAcademicaSchema>;

export const ExecutarMudancaAcademicaSchema = z.object({ motivo, horarioCompativel: HorarioCompativelSchema });
export type ExecutarMudancaAcademicaInput = z.input<typeof ExecutarMudancaAcademicaSchema>;
export const CancelarMudancaAcademicaSchema = z.object({ motivo });
export type CancelarMudancaAcademicaInput = z.input<typeof CancelarMudancaAcademicaSchema>;

export const FiltrosSolicitacoesAcademicasSchema = z.object({
  alunoId: z.string().trim().min(1).optional(),
  matriculaId: z.string().trim().min(1).optional(),
  apenasAbertas: z.boolean().optional(),
  antesDe: z.string().trim().min(1).optional(),
});

export interface ContextoMudancaAcademica {
  alunoId: string;
  alunoNome: string;
  status: string;
  origem: { alocacaoId: string; matriculaId: string | null; turmaId: string; label: string; diasHorario: string | null; nivelId: string; idiomaId: string; modalidadeId: string } | null;
  destinos: { id: string; label: string; diasHorario: string | null; tipo: "EQUIVALENTE" | "EXCECAO"; vagas: number }[];
  podeSolicitar: boolean;
  podeTransferirEquivalente: boolean;
  podePrepararEquivalencia: boolean;
  pedidoAbertoId: string | null;
  impedimento: string | null;
}

export interface SolicitacaoAcademicaView {
  id: string;
  alunoId: string;
  alunoNome: string;
  status: StatusMudancaAcademica;
  motivo: string;
  criadoEm: string;
  origem: { label: string; diasHorario: string | null };
  destino: { label: string; diasHorario: string | null };
  solicitante: { id: string; nome: string };
  aprovador: { id: string; nome: string } | null;
  executor: { id: string; nome: string } | null;
  cancelador: { id: string; nome: string } | null;
  motivoDecisao: string | null;
  justificativaDispensaParecer: string | null;
  motivoExecucao: string | null;
  motivoCancelamento: string | null;
  decididoEm: string | null;
  executadoEm: string | null;
  canceladoEm: string | null;
  pareceres: { id: string; autorNome: string; conteudo: string; criadoEm: string }[];
  temParecerVigente: boolean;
  podeDarParecer: boolean;
  podeDecidir: boolean;
  podeExecutar: boolean;
  podeCancelar: boolean;
  impedimento: string | null;
}
