import { Papel, Prisma } from "@prisma/client";
import { ReplanejamentoSnapshotSchema } from "@/server/agenda/replanejamento-snapshot";

type ClienteAgendaDestino = Pick<Prisma.TransactionClient,
  "versaoCalendarioEscolar" | "propostaGradeTurma" | "encontroAgenda" | "indisponibilidadeDocente" | "rascunhoReplanejamento">;

export type FotografiaAgendaDestino = {
  gradeId: string;
  gradeVersao: number;
  calendarioId: string;
  calendarioVersao: number;
  calendarioVigenteId: string;
  calendarioVigenteVersao: number;
  cadeiaCalendario:
    | { tipo: "GRADE_PUBLICADA" }
    | { tipo: "REPLANEJAMENTO_APLICADO"; rascunhoId: string; decisaoId: string; aplicacaoId: string; estadoHash: string };
  encontros: Array<{
    id: string;
    inicio: string;
    fim: string;
    status: string;
    professorId: string | null;
    professorApto: boolean;
  }>;
  indisponibilidades: Array<{ id: string; professorId: string; inicio: string; fim: string }>;
};

type EncontroDaAgenda = {
  id: string;
  inicio: Date;
  fim: Date;
  status: string;
};

/**
 * Uma grade continua sendo a fonte histórica dos encontros depois de um
 * replanejamento: a aplicação move os encontros, mas não a reescreve para o
 * calendário novo. A cadeia só é aceita quando a revisão aplicada contém a
 * turma e cada encontro atual da grade corresponde ao resultado conferido.
 */
function cadeiaReplanejamentoDaAgenda(
  revisoes: Array<{
    id: string;
    estadoHash: string;
    snapshot: unknown;
    decisaoConjunta: { id: string; aprovada: boolean; estadoHash: string } | null;
    aplicacaoConjunta: { id: string; estadoHash: string } | null;
  }>,
  turmaId: string,
  agenda: readonly EncontroDaAgenda[],
  agora: Date,
) {
  for (const revisao of revisoes) {
    if (!revisao.decisaoConjunta?.aprovada || !revisao.aplicacaoConjunta
      || revisao.decisaoConjunta.estadoHash !== revisao.estadoHash
      || revisao.aplicacaoConjunta.estadoHash !== revisao.estadoHash) continue;
    const snapshot = ReplanejamentoSnapshotSchema.safeParse(revisao.snapshot);
    if (!snapshot.success) continue;
    const turma = snapshot.data.revisoes.find((item) => item.turmaId === turmaId);
    if (!turma?.previsao) continue;
    const esperados = new Map<string, { inicio: string; fim: string; status: string }>();
    for (const encontro of turma.previsao.propostas) {
      esperados.set(encontro.encontroId, { inicio: encontro.inicioProposto, fim: encontro.fimProposto, status: "PREVISTO" });
    }
    for (const encontro of turma.previsao.preservados) {
      esperados.set(encontro.id, { inicio: encontro.inicio, fim: encontro.fim, status: encontro.status });
    }
    const agendaFutura = agenda.filter((encontro) => encontro.inicio >= agora);
    const esperadosFuturos = [...esperados.entries()].filter(([, encontro]) => new Date(encontro.inicio) >= agora);
    if (!agendaFutura.length || agendaFutura.length !== esperadosFuturos.length || agendaFutura.some((encontro) => {
      const esperado = esperados.get(encontro.id);
      return !esperado || esperado.inicio !== encontro.inicio.toISOString()
        || esperado.fim !== encontro.fim.toISOString() || esperado.status !== encontro.status;
    }) || esperadosFuturos.some(([id]) => !agendaFutura.some((encontro) => encontro.id === id))) continue;
    return {
      tipo: "REPLANEJAMENTO_APLICADO" as const,
      rascunhoId: revisao.id,
      decisaoId: revisao.decisaoConjunta.id,
      aplicacaoId: revisao.aplicacaoConjunta.id,
      estadoHash: revisao.estadoHash,
    };
  }
  return null;
}

export type OfertaAgendaDestino = {
  disponivel: boolean;
  fotografia: FotografiaAgendaDestino | null;
};

/**
 * A data manual da turma é somente uma previsão legada. A disponibilidade
 * para um novo vínculo vem da grade aprovada no calendário vigente e da
 * existência de aula regular futura. O relógio não entra na fotografia:
 * passar do tempo só torna a oferta indisponível quando não resta aula futura.
 */
export async function carregarOfertasAgendaDestinoTx(
  tx: ClienteAgendaDestino,
  turmaIds: readonly string[],
  agora: Date,
): Promise<Map<string, OfertaAgendaDestino>> {
  const ids = [...new Set(turmaIds)].sort();
  const resultado = new Map<string, OfertaAgendaDestino>();
  if (!ids.length) return resultado;

  const calendarioVigente = await tx.versaoCalendarioEscolar.findFirst({
    where: { decisao: { aprovada: true } },
    orderBy: [{ versao: "desc" }, { id: "desc" }],
    select: { id: true, versao: true },
  });
  const grades = await tx.propostaGradeTurma.findMany({
    where: {
      turmaId: { in: ids },
      decisao: { aprovada: true },
      calendario: { decisao: { aprovada: true } },
    },
    orderBy: [{ turmaId: "asc" }, { versao: "desc" }, { id: "desc" }],
    select: { id: true, turmaId: true, versao: true, calendarioId: true, calendario: { select: { versao: true } } },
  });
  const gradePorTurma = new Map<string, (typeof grades)[number]>();
  for (const grade of grades) if (!gradePorTurma.has(grade.turmaId)) gradePorTurma.set(grade.turmaId, grade);

  const revisoesVigentes = calendarioVigente ? await tx.rascunhoReplanejamento.findMany({
    where: { calendarioId: calendarioVigente.id },
    orderBy: [{ versao: "desc" }, { id: "desc" }],
    select: {
      id: true, estadoHash: true, snapshot: true,
      decisaoConjunta: { select: { id: true, aprovada: true, estadoHash: true } },
      aplicacaoConjunta: { select: { id: true, estadoHash: true } },
    },
  }) : [];

  const encontros = await tx.encontroAgenda.findMany({
    where: { turmaId: { in: ids }, matriculaId: null, finalidade: "AULA", propostaGradeId: { not: null } },
    orderBy: [{ propostaGradeId: "asc" }, { inicio: "asc" }, { id: "asc" }],
    select: {
      id: true, turmaId: true, propostaGradeId: true, inicio: true, fim: true, status: true, professorId: true,
      professor: { select: { ativo: true, papeis: true } },
    },
  });
  const encontrosPorGrade = new Map<string, (typeof encontros)>();
  for (const encontro of encontros) {
    if (!encontro.propostaGradeId) continue;
    const atuais = encontrosPorGrade.get(encontro.propostaGradeId) ?? [];
    atuais.push(encontro);
    encontrosPorGrade.set(encontro.propostaGradeId, atuais);
  }

  const encontrosElegiveis = encontros.filter((encontro) => {
    const grade = encontro.turmaId ? gradePorTurma.get(encontro.turmaId) : undefined;
    return grade?.id === encontro.propostaGradeId
      && encontro.status === "PREVISTO"
      && encontro.fim > encontro.inicio
      && !!encontro.professorId
      && !!encontro.professor?.ativo
      && encontro.professor.papeis.includes(Papel.PROFESSOR);
  });
  const ausencias = encontrosElegiveis.length ? await tx.indisponibilidadeDocente.findMany({
    where: {
      decisao: { aprovada: true },
      OR: encontrosElegiveis.map((encontro) => ({
        professorId: encontro.professorId!, inicio: { lt: encontro.fim }, fim: { gt: encontro.inicio },
      })),
    },
    orderBy: [{ inicio: "asc" }, { id: "asc" }],
    select: { id: true, professorId: true, inicio: true, fim: true },
  }) : [];

  for (const turmaId of ids) {
    const grade = gradePorTurma.get(turmaId);
    if (!grade || !calendarioVigente) {
      resultado.set(turmaId, { disponivel: false, fotografia: null });
      continue;
    }
    const agenda = encontrosPorGrade.get(grade.id) ?? [];
    const cadeiaCalendario = grade.calendarioId === calendarioVigente.id && grade.calendario.versao === calendarioVigente.versao
      ? { tipo: "GRADE_PUBLICADA" as const }
      : cadeiaReplanejamentoDaAgenda(revisoesVigentes, turmaId, agenda, agora);
    if (!cadeiaCalendario) {
      resultado.set(turmaId, { disponivel: false, fotografia: null });
      continue;
    }
    const fotografia: FotografiaAgendaDestino = {
      gradeId: grade.id,
      gradeVersao: grade.versao,
      calendarioId: grade.calendarioId,
      calendarioVersao: grade.calendario.versao,
      calendarioVigenteId: calendarioVigente.id,
      calendarioVigenteVersao: calendarioVigente.versao,
      cadeiaCalendario,
      encontros: agenda.map((encontro) => ({
        id: encontro.id,
        inicio: encontro.inicio.toISOString(),
        fim: encontro.fim.toISOString(),
        status: encontro.status,
        professorId: encontro.professorId,
        professorApto: !!encontro.professorId && !!encontro.professor?.ativo && encontro.professor.papeis.includes(Papel.PROFESSOR),
      })),
      indisponibilidades: ausencias
        .filter((ausencia) => encontrosElegiveis.some((encontro) => encontro.turmaId === turmaId && encontro.professorId === ausencia.professorId && ausencia.inicio < encontro.fim && ausencia.fim > encontro.inicio))
        .map((ausencia) => ({ id: ausencia.id, professorId: ausencia.professorId, inicio: ausencia.inicio.toISOString(), fim: ausencia.fim.toISOString() })),
    };
    const futurosDaTurma = encontrosElegiveis.filter((encontro) => encontro.turmaId === turmaId && encontro.inicio >= agora);
    const futuroComAusencia = futurosDaTurma.some((encontro) => fotografia.indisponibilidades.some((ausencia) =>
      ausencia.professorId === encontro.professorId && new Date(ausencia.inicio) < encontro.fim && new Date(ausencia.fim) > encontro.inicio));
    resultado.set(turmaId, { disponivel: futurosDaTurma.length > 0 && !futuroComAusencia, fotografia });
  }
  return resultado;
}
