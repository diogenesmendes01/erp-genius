import { hashSubstituicao } from "@/server/contratos/substituicao-estado";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { dataCivilInstitucional } from "@/server/operacao/fuso";

const Entrada = z.object({ matriculaId: z.string().trim().min(1), inicio: z.date(), fim: z.date() }).strict().superRefine((d, ctx) => {
  for (const [campo, data] of [["inicio", d.inicio], ["fim", d.fim]] as const) {
    if (!Number.isFinite(data.getTime()) || data.getUTCHours() || data.getUTCMinutes() || data.getUTCSeconds() || data.getUTCMilliseconds()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message: "A cobertura deve usar data civil UTC." });
  }
  if (d.fim < d.inicio) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fim"], message: "PerÃ­odo de continuidade invÃ¡lido." });
});

type Fonte = { alocacaoId: string; turmaId: string; gradeId: string; gradeVersao: number; calendarioId: string; calendarioVersao: number; encontros: Array<{ id: string; inicio: string; fim: string; status: string; professorId: string | null }>; };
type Motivo = "VINCULO_AUSENTE" | "TURMA_SEM_OFERTA_ATIVA" | "TURMA_TERMINA_NO_PERIODO" | "GRADE_NAO_PUBLICADA" | "GRADE_DIVERGENTE" | "CALENDARIO_DIVERGENTE" | "AGENDA_INSUFICIENTE" | "AULA_EXCEPCIONAL_NO_PERIODO" | "DOCENTE_INAPTO" | "DOCENTE_INDISPONIVEL";
const civil = (data: Date, fuso: string) => dataCivilInstitucional(data, fuso);
/** Encontros são intervalos [inicio, fim): meia-noite no fim não ocupa o novo dia civil. */
const civilFimInclusivo = (data: Date, fuso: string) => civil(new Date(data.getTime() - 1), fuso);


/** Q161: a prova automÃ¡tica Ã© estreita; lacunas nunca declaram indisponibilidade. */
export async function carregarComprovacaoOfertaContinuidadeAgendaTx(tx: Pick<Prisma.TransactionClient, "alocacaoTurma" | "indisponibilidadeDocente" | "versaoCalendarioEscolar">, input: z.input<typeof Entrada>) {
  const d = Entrada.parse(input);
  const alocacoes = await tx.alocacaoTurma.findMany({
    where: { matriculaId: d.matriculaId, ativa: true, criadoEm: { lte: d.inicio }, encerradaEm: null },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    select: { id: true, turmaId: true, turma: { select: {
      id: true, status: true, dataFim: true,
      propostasGrade: { where: { decisao: { aprovada: true }, calendario: { decisao: { aprovada: true } } }, orderBy: [{ versao: "desc" }, { id: "desc" }], take: 2, select: { id: true, versao: true, calendarioId: true, calendario: { select: { versao: true, fusoInstitucional: true } } } },
      encontrosAgenda: { orderBy: [{ inicio: "asc" }, { id: "asc" }], select: { id: true, inicio: true, fim: true, status: true, finalidade: true, matriculaId: true, propostaGradeId: true, professorId: true, professor: { select: { ativo: true, papeis: true } } } },
    } } },
  });
  const calendarioVigente = await tx.versaoCalendarioEscolar.findFirst({
    where: { decisao: { aprovada: true } }, orderBy: [{ versao: "desc" }, { id: "desc" }], select: { id: true, versao: true },
  });
  const encontrosConferidos = alocacoes.flatMap(a => a.turma.encontrosAgenda)
    .filter(e => e.finalidade === "AULA" && e.matriculaId === null && e.professorId && e.fim > e.inicio);
  const ausencias = encontrosConferidos.length ? await tx.indisponibilidadeDocente.findMany({
    where: { decisao: { aprovada: true }, OR: encontrosConferidos.map(e => ({ professorId: e.professorId!, inicio: { lt: e.fim }, fim: { gt: e.inicio } })) },
    select: { id: true, professorId: true, inicio: true, fim: true }, orderBy: [{ inicio: "asc" }, { id: "asc" }],
  }) : [];
  // Mesmo uma agenda insuficiente possui fontes que podem mudar após a aprovação humana.
  const contextoHash = hashSubstituicao(JSON.parse(JSON.stringify({ alocacoes, calendarioVigente, ausencias })) as Prisma.JsonValue);
  const exigir = (motivo: Motivo) => ({ estado: "EXIGE_CONFIRMACAO_GESTAO" as const, memoria: { fontes: [] as Fonte[], motivos: [motivo], contextoHash } });
  if (alocacoes.length !== 1 || !alocacoes[0]?.turma) return exigir("VINCULO_AUSENTE");
  const alocacao = alocacoes[0], turma = alocacao.turma;
  if (turma.status !== "ABERTA" && turma.status !== "EM_ANDAMENTO") return exigir("TURMA_SEM_OFERTA_ATIVA");
  const grade = turma.propostasGrade[0];
  if (!grade) return exigir("GRADE_NAO_PUBLICADA");
  const inicioCivil = d.inicio.toISOString().slice(0, 10), fimCivil = d.fim.toISOString().slice(0, 10), fuso = grade.calendario.fusoInstitucional;
  if (turma.dataFim && civil(turma.dataFim, fuso) < fimCivil) return exigir("TURMA_TERMINA_NO_PERIODO");
  if (!calendarioVigente || calendarioVigente.id !== grade.calendarioId || calendarioVigente.versao !== grade.calendario.versao) return exigir("CALENDARIO_DIVERGENTE");

  const aulas = turma.encontrosAgenda.filter((e) => e.finalidade === "AULA" && e.matriculaId === null && e.fim > e.inicio);
  const noPeriodo = aulas.filter((e) => civil(e.inicio, fuso) <= fimCivil && civilFimInclusivo(e.fim, fuso) >= inicioCivil);
  if (!noPeriodo.length) return exigir("AGENDA_INSUFICIENTE");
  if (noPeriodo.some((e) => e.propostaGradeId !== grade.id)) return exigir("GRADE_DIVERGENTE");
  if (noPeriodo.some((e) => e.status !== "PREVISTO" && e.status !== "MINISTRADO")) return exigir("AULA_EXCEPCIONAL_NO_PERIODO");
  const aceitas = aulas.filter((e) => e.propostaGradeId === grade.id && (e.status === "PREVISTO" || e.status === "MINISTRADO"));
  if (!aceitas.length || !aceitas.some((e) => civil(e.inicio, fuso) <= inicioCivil) || !aceitas.some((e) => civilFimInclusivo(e.fim, fuso) >= fimCivil)) return exigir("AGENDA_INSUFICIENTE");
  if (aceitas.some((e) => !e.professorId || !e.professor?.ativo || !e.professor.papeis.includes("PROFESSOR"))) return exigir("DOCENTE_INAPTO");

  if (ausencias.length) return exigir("DOCENTE_INDISPONIVEL");
  const fonte: Fonte = { alocacaoId: alocacao.id, turmaId: turma.id, gradeId: grade.id, gradeVersao: grade.versao, calendarioId: grade.calendarioId, calendarioVersao: grade.calendario.versao, encontros: aceitas.map((e) => ({ id: e.id, inicio: e.inicio.toISOString(), fim: e.fim.toISOString(), status: e.status, professorId: e.professorId })) };
  return { estado: "COMPROVADA_POR_AGENDA" as const, memoria: { fontes: [fonte], motivos: [] as Motivo[], contextoHash } };
}
