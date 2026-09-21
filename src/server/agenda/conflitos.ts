"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";

/** Prévia de sobreposição; não autoriza publicação nem substitui revalidação transacional. */
export async function consultarConflitosEncontro(input: { encontroId: string }) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ encontroId: z.string().min(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const e = await tx.encontroAgenda.findUnique({ where: { id: d.encontroId }, include: { professor: { select: { ativo: true, papeis: true } } } });
      if (!e) throw new ErroRegra("Encontro não encontrado.");
      const pendencias: string[] = [];
      if (!e.professorId || !e.professor?.ativo || !e.professor.papeis.includes("PROFESSOR")) pendencias.push("Defina um professor ativo antes da publicação.");
      const recursos: Prisma.EncontroAgendaWhereInput[] = [];
      if (e.professorId) recursos.push({ professorId: e.professorId });
      if (e.turmaId) recursos.push({ turmaId: e.turmaId });
      if (e.matriculaId) recursos.push({ matriculaId: e.matriculaId });
      const encontrados = await tx.encontroAgenda.findMany({ where: { id: { not: e.id }, status: { in: ["PREVISTO", "MINISTRADO"] }, inicio: { lt: e.fim }, fim: { gt: e.inicio }, OR: recursos },
        orderBy: [{ inicio: "asc" }, { id: "asc" }], select: { id: true, inicio: true, fim: true, professorId: true, turmaId: true, matriculaId: true } });
      const ausencias = e.professorId ? await tx.indisponibilidadeDocente.findMany({ where: { professorId: e.professorId, decisao: { aprovada: true }, inicio: { lt: e.fim }, fim: { gt: e.inicio } }, select: { id: true, inicio: true, fim: true } }) : [];
      return { encontroId: e.id, pendencias, indisponibilidades: ausencias.map((a) => ({ id: a.id, inicio: a.inicio.toISOString(), fim: a.fim.toISOString() })), conflitos: encontrados.map((outro) => ({ id: outro.id, inicio: outro.inicio.toISOString(), fim: outro.fim.toISOString(),
        professor: !!e.professorId && outro.professorId === e.professorId, turma: !!e.turmaId && outro.turmaId === e.turmaId, matricula: !!e.matriculaId && outro.matriculaId === e.matriculaId })),
        publicacaoAutorizada: false as const, verificacoesPendentes: ["Calendário institucional e exceções aprovadas", "Reservas de horários de contratações", "Condições da turma/matrícula e aprovação da agenda"], conferidoEm: new Date().toISOString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
