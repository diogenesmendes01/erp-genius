import { instanteDaGrade } from "@/server/agenda/grade";
import { alocacaoCobreAula } from "@/server/diario/alocacoes";
import { hashSubstituicao } from "@/server/contratos/substituicao-estado";
import { ancorarCalendarioOferta, type AncoraCalendarioOferta } from "@/server/agenda/cadeia-calendario-oferta";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { dataCivilInstitucional } from "@/server/operacao/fuso";

const Entrada = z.object({ matriculaId: z.string().trim().min(1), inicio: z.date(), fim: z.date() }).strict().superRefine((d, ctx) => {
  for (const [campo, data] of [["inicio", d.inicio], ["fim", d.fim]] as const) {
    if (!Number.isFinite(data.getTime()) || data.getUTCHours() || data.getUTCMinutes() || data.getUTCSeconds() || data.getUTCMilliseconds()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message: "A cobertura deve usar data civil UTC." });
  }
  if (d.fim < d.inicio) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fim"], message: "Período de continuidade inválido." });
});

type Fonte = { alocacaoId: string; turmaId: string; gradeId: string; gradeVersao: number; calendarioId: string; calendarioVersao: number; ancoraCalendario: AncoraCalendarioOferta; encontros: Array<{ id: string; inicio: string; fim: string; status: string; professorId: string | null }>; };
type Motivo = "VINCULO_AUSENTE" | "TURMA_SEM_OFERTA_ATIVA" | "TURMA_TERMINA_NO_PERIODO" | "GRADE_NAO_PUBLICADA" | "GRADE_DIVERGENTE" | "CALENDARIO_DIVERGENTE" | "AGENDA_INSUFICIENTE" | "AULA_EXCEPCIONAL_NO_PERIODO" | "DOCENTE_INAPTO" | "DOCENTE_INDISPONIVEL";
const civil = (data: Date, fuso: string) => dataCivilInstitucional(data, fuso);
/** Encontros são intervalos [inicio, fim): meia-noite no fim não ocupa o novo dia civil. */
const civilFimInclusivo = (data: Date, fuso: string) => civil(new Date(data.getTime() - 1), fuso);


/** Q161: a prova automática é estreita; lacunas nunca declaram indisponibilidade. */
export async function carregarComprovacaoOfertaContinuidadeAgendaTx(tx: Pick<Prisma.TransactionClient, "alocacaoTurma" | "indisponibilidadeDocente" | "versaoCalendarioEscolar" | "impactoQuantidadeAulasModalidade">, input: z.input<typeof Entrada>) {
  const d = Entrada.parse(input);
  const alocacoes = await tx.alocacaoTurma.findMany({
    where: { matriculaId: d.matriculaId, ativa: true, encerradaEm: null, OR: [{ provenienciaVinculo: null, criadoEm: { lte: d.inicio } }, { provenienciaVinculo: "MIGRACAO" }] },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    select: { id: true, turmaId: true, ativa: true, criadoEm: true, encerradaEm: true, provenienciaVinculo: true, inicioVigencia: true, fimVigencia: true, turma: { select: {
      id: true, status: true, dataFim: true,
      propostasGrade: { where: { decisao: { aprovada: true }, calendario: { decisao: { aprovada: true } } }, orderBy: [{ versao: "desc" }, { id: "desc" }], take: 2, select: { id: true, versao: true, calendarioId: true, calendario: { select: { versao: true, fusoInstitucional: true } } } },
      encontrosAgenda: { orderBy: [{ inicio: "asc" }, { id: "asc" }], select: { id: true, inicio: true, fim: true, status: true, finalidade: true, matriculaId: true, propostaGradeId: true, professorId: true, professor: { select: { ativo: true, papeis: true } } } },
    } } },
  });
  const calendarioVigente = await tx.versaoCalendarioEscolar.findFirst({
    where: { decisao: { aprovada: true } }, orderBy: [{ versao: "desc" }, { id: "desc" }], select: {
      id: true, versao: true,
      replanejamentos: { orderBy: [{ versao: "desc" }, { id: "desc" }], select: {
        id: true, estadoHash: true, snapshot: true,
        decisaoConjunta: { select: { id: true, aprovada: true, estadoHash: true, aplicacao: { select: { id: true, estadoHash: true, aplicadaEm: true } } } },
      } },
    },
  });
  const encontrosConferidos = alocacoes.flatMap(a => a.turma.encontrosAgenda)
    .filter(e => e.finalidade === "AULA" && e.matriculaId === null && e.professorId && e.fim > e.inicio);
  const ausencias = encontrosConferidos.length ? await tx.indisponibilidadeDocente.findMany({
    where: { decisao: { aprovada: true }, OR: encontrosConferidos.map(e => ({ professorId: e.professorId!, inicio: { lt: e.fim }, fim: { gt: e.inicio } })) },
    select: { id: true, professorId: true, inicio: true, fim: true }, orderBy: [{ inicio: "asc" }, { id: "asc" }],
  }) : [];
  // Só a cadeia pós-replanejamento compara a agenda; alterações de quantidade aplicadas são os elos posteriores aceitos.
  const turmaIds = [...new Set(alocacoes.map((a) => a.turmaId))];
  const impactos = turmaIds.length ? await tx.impactoQuantidadeAulasModalidade.findMany({
    where: { turmaId: { in: turmaIds }, proposta: { aplicacao: { isNot: null } } }, orderBy: [{ criadoEm: "asc" }, { id: "asc" }],
    select: { id: true, turmaId: true, snapshot: true, proposta: { select: { id: true, estadoHash: true,
      decisao: { select: { id: true, aprovada: true, estadoHash: true } }, aplicacao: { select: { id: true, estadoHash: true, aplicadaEm: true } } } } },
  }) : [];
  // Mesmo uma agenda insuficiente possui fontes que podem mudar após a aprovação humana.
  // `aplicadaEm` só ordena os elos; fica fora do hash para não invalidar memórias já confirmadas.
  const calendarioNoHash = calendarioVigente && { ...calendarioVigente, replanejamentos: calendarioVigente.replanejamentos?.map((r) => ({ ...r,
    decisaoConjunta: r.decisaoConjunta && { ...r.decisaoConjunta, aplicacao: r.decisaoConjunta.aplicacao && { id: r.decisaoConjunta.aplicacao.id, estadoHash: r.decisaoConjunta.aplicacao.estadoHash } } })) };
  const contextoHash = hashSubstituicao(JSON.parse(JSON.stringify({ alocacoes, calendarioVigente: calendarioNoHash, ausencias, ...(impactos.length ? { impactosQuantidade: impactos } : {}) })) as Prisma.JsonValue);
  const exigir = (motivo: Motivo) => ({ estado: "EXIGE_CONFIRMACAO_GESTAO" as const, memoria: { fontes: [] as Fonte[], motivos: [motivo], contextoHash } });
  if (alocacoes.length !== 1 || !alocacoes[0]?.turma) return exigir("VINCULO_AUSENTE");
  const alocacao = alocacoes[0], turma = alocacao.turma;
  if (turma.status !== "ABERTA" && turma.status !== "EM_ANDAMENTO") return exigir("TURMA_SEM_OFERTA_ATIVA");
  const grade = turma.propostasGrade[0];
  if (!grade) return exigir("GRADE_NAO_PUBLICADA");
  const inicioCivil = d.inicio.toISOString().slice(0, 10), fimCivil = d.fim.toISOString().slice(0, 10), fuso = grade.calendario.fusoInstitucional;
  if (alocacao.provenienciaVinculo === "MIGRACAO") {
    // Cobertura é civil no fuso institucional; cadastro/importação não prova vínculo.
    try {
      const inicioCobertura = instanteDaGrade(inicioCivil, "00:00", fuso);
      const proximoDia = new Date(d.fim.getTime() + 86_400_000).toISOString().slice(0, 10);
      const fimCobertura = new Date(instanteDaGrade(proximoDia, "00:00", fuso).getTime() - 1);
      if (!alocacaoCobreAula(alocacao, inicioCobertura) || !alocacaoCobreAula(alocacao, fimCobertura)) return exigir("VINCULO_AUSENTE");
    } catch { return exigir("VINCULO_AUSENTE"); }
  }
  const aulas = turma.encontrosAgenda.filter((e) => e.finalidade === "AULA" && e.matriculaId === null && e.fim > e.inicio);
  const ancoraCalendario = ancorarCalendarioOferta({
    grade: { calendarioId: grade.calendarioId, calendarioVersao: grade.calendario.versao },
    calendarioVigente, turmaId: turma.id,
    encontros: aulas.map((encontro) => ({ id: encontro.id, inicio: encontro.inicio, fim: encontro.fim, status: encontro.status })),
    alteracoesQuantidade: impactos.filter((i) => i.turmaId === turma.id).map((i) => ({
      propostaId: i.proposta.id, estadoHash: i.proposta.estadoHash, impactoSnapshot: i.snapshot, decisao: i.proposta.decisao, aplicacao: i.proposta.aplicacao,
    })),
  });
  if (!ancoraCalendario) return exigir("CALENDARIO_DIVERGENTE");
  const noPeriodo = aulas.filter((e) => civil(e.inicio, fuso) <= fimCivil && civilFimInclusivo(e.fim, fuso) >= inicioCivil);
  if (!noPeriodo.length) return exigir("AGENDA_INSUFICIENTE");
  if (noPeriodo.some((e) => e.propostaGradeId !== grade.id)) return exigir("GRADE_DIVERGENTE");
  if (noPeriodo.some((e) => e.status !== "PREVISTO" && e.status !== "MINISTRADO")) return exigir("AULA_EXCEPCIONAL_NO_PERIODO");
  const aceitas = aulas.filter((e) => e.propostaGradeId === grade.id && (e.status === "PREVISTO" || e.status === "MINISTRADO"));
  if (!aceitas.length || !aceitas.some((e) => civil(e.inicio, fuso) <= inicioCivil) || !aceitas.some((e) => civilFimInclusivo(e.fim, fuso) >= fimCivil)) return exigir("AGENDA_INSUFICIENTE");
  if (aceitas.some((e) => !e.professorId || !e.professor?.ativo || !e.professor.papeis.includes("PROFESSOR"))) return exigir("DOCENTE_INAPTO");

  if (ausencias.length) return exigir("DOCENTE_INDISPONIVEL");
  const fonte: Fonte = { alocacaoId: alocacao.id, turmaId: turma.id, gradeId: grade.id, gradeVersao: grade.versao, calendarioId: grade.calendarioId, calendarioVersao: grade.calendario.versao, ancoraCalendario, encontros: aceitas.map((e) => ({ id: e.id, inicio: e.inicio.toISOString(), fim: e.fim.toISOString(), status: e.status, professorId: e.professorId })) };
  return { estado: "COMPROVADA_POR_AGENDA" as const, memoria: { fontes: [fonte], motivos: [] as Motivo[], contextoHash } };
}
