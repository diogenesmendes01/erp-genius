import type { Prisma } from "@prisma/client";

type Grade = {
  turmaId: string;
  origem: { professorId: string | null };
  grade: { encontros: { inicio: string; fim: string }[] };
};

/** Verifica intervalos reais; o mesmo dia da semana em outro período não é conflito. */
export async function conferirDisponibilidadeGrade(tx: Prisma.TransactionClient, proposta: Grade) {
  const { professorId } = proposta.origem;
  const professor = professorId ? await tx.usuario.findUnique({ where: { id: professorId }, select: { ativo: true, papeis: true } }) : null;
  const professorApto = !!professor?.ativo && professor.papeis.includes("PROFESSOR");
  const intervalos = proposta.grade.encontros.map((e, indice) => ({ ...e, indice, inicioMs: Date.parse(e.inicio), fimMs: Date.parse(e.fim) }));
  const conflitosInternos: { primeiro: number; segundo: number }[] = [];
  for (let i = 0; i < intervalos.length; i++) {
    for (let j = i + 1; j < intervalos.length; j++) {
      if (intervalos[i].inicioMs < intervalos[j].fimMs && intervalos[j].inicioMs < intervalos[i].fimMs) conflitosInternos.push({ primeiro: i, segundo: j });
    }
  }
  const recursos: Prisma.EncontroAgendaWhereInput[] = [{ turmaId: proposta.turmaId }];
  if (professorId) recursos.push({ professorId });
  const existentes = intervalos.length ? await tx.encontroAgenda.findMany({
    where: {
      status: { in: ["PREVISTO", "MINISTRADO"] }, OR: recursos,
      inicio: { lt: new Date(Math.max(...intervalos.map((e) => e.fimMs))) },
      fim: { gt: new Date(Math.min(...intervalos.map((e) => e.inicioMs))) },
    },
    orderBy: [{ inicio: "asc" }, { id: "asc" }],
    select: { id: true, inicio: true, fim: true, professorId: true, turmaId: true },
  }) : [];
  const conflitos = intervalos.flatMap((e) => existentes
    .filter((outro) => e.inicioMs < outro.fim.getTime() && outro.inicio.getTime() < e.fimMs)
    .map((outro) => ({ indiceEncontro: e.indice, inicioProposto: e.inicio, fimProposto: e.fim,
      encontroExistenteId: outro.id, inicioExistente: outro.inicio.toISOString(), fimExistente: outro.fim.toISOString(),
      professor: !!professorId && professorId === outro.professorId, turma: outro.turmaId === proposta.turmaId,
    })));
  const ausencias = professorId && intervalos.length ? await tx.indisponibilidadeDocente.findMany({ where: {
    professorId, decisao: { aprovada: true }, inicio: { lt: new Date(Math.max(...intervalos.map((e) => e.fimMs))) },
    fim: { gt: new Date(Math.min(...intervalos.map((e) => e.inicioMs))) },
  }, select: { id: true, inicio: true, fim: true }, orderBy: [{ inicio: "asc" }, { id: "asc" }] }) : [];
  const indisponibilidades = intervalos.flatMap((e) => ausencias.filter((a) => e.inicioMs < a.fim.getTime() && a.inicio.getTime() < e.fimMs)
    .map((a) => ({ indiceEncontro: e.indice, indisponibilidadeId: a.id, inicio: a.inicio.toISOString(), fim: a.fim.toISOString() })));
  const reservas = professorId && intervalos.length ? await tx.horarioReservaParticular.findMany({ where: { professorId, reserva: { status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } }, OR: intervalos.map((e) => ({ inicio: { lt: new Date(e.fimMs) }, fim: { gt: new Date(e.inicioMs) } })) }, select: { id: true, reservaId: true, inicio: true, fim: true } }) : [];
  return { reservas, professorApto, conflitos, conflitosInternos, indisponibilidades,
    verificacoesPendentes: ["Aprovação e publicação transacional da grade"],
    disponibilidadeConfirmada: false as const,
  };
}
