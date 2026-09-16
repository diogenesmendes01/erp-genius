import type { Prisma } from "@prisma/client";

/** O encontro ignorado, quando informado, deve ser a origem conferida pelo chamador. */
export async function disponibilidadeRecuperacaoTx(tx: Prisma.TransactionClient, d: {
  alunoId: string; professorId: string | null; inicio: Date; fim: Date; ignorarEncontroId?: string;
}) {
  const alocacoes = await tx.alocacaoTurma.findMany({ where: { alunoId: d.alunoId, criadoEm: { lt: d.fim }, OR: [{ encerradaEm: null }, { encerradaEm: { gt: d.inicio } }] }, select: { turmaId: true, criadoEm: true, encerradaEm: true } });
  const recursos: Prisma.EncontroAgendaWhereInput[] = [{ matricula: { alunoId: d.alunoId } }, ...alocacoes.map(v => ({ turmaId: v.turmaId, matriculaId: null, inicio: { lt: v.encerradaEm ?? d.fim }, fim: { gt: v.criadoEm } }))];
  if (d.professorId) recursos.push({ professorId: d.professorId });
  const encontros = await tx.encontroAgenda.findMany({ where: { ...(d.ignorarEncontroId ? { id: { not: d.ignorarEncontroId } } : {}), status: { in: ["PREVISTO", "MINISTRADO"] }, inicio: { lt: d.fim }, fim: { gt: d.inicio }, OR: recursos }, select: { inicio: true, fim: true, professorId: true }, orderBy: [{ inicio: "asc" }, { id: "asc" }] });
  const indisponibilidades = d.professorId ? await tx.indisponibilidadeDocente.count({ where: { professorId: d.professorId, decisao: { aprovada: true }, inicio: { lt: d.fim }, fim: { gt: d.inicio } } }) : 0;
  const reservas = await tx.horarioReservaParticular.count({ where: { inicio: { lt: d.fim }, fim: { gt: d.inicio }, reserva: { status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } }, OR: [{ reserva: { matricula: { alunoId: d.alunoId } } }, ...(d.professorId ? [{ professorId: d.professorId }] : [])] } });
  return { encontros, indisponibilidades, reservas };
}
