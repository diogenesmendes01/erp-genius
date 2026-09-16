import type { Prisma } from "@prisma/client";

/** O encontro ignorado, quando informado, deve ser a origem conferida pelo chamador. */
export async function disponibilidadeRecuperacaoTx(tx: Prisma.TransactionClient, d: {
  alunoId: string; professorId: string | null; inicio: Date; fim: Date; ignorarEncontroId?: string;
}) {
  const alocacoes = await tx.alocacaoTurma.findMany({ where: { alunoId: d.alunoId, OR: [{ provenienciaVinculo: "MIGRACAO", inicioVigencia: { lt: d.fim }, AND: [{ OR: [{ fimVigencia: null }, { fimVigencia: { gt: d.inicio } }] }, { OR: [{ encerradaEm: null }, { encerradaEm: { gt: d.inicio } }] }] }, { provenienciaVinculo: null, criadoEm: { lt: d.fim }, OR: [{ encerradaEm: null }, { encerradaEm: { gt: d.inicio } }] }] }, select: { turmaId: true, criadoEm: true, encerradaEm: true, provenienciaVinculo: true, inicioVigencia: true, fimVigencia: true } });
  const recursos: Prisma.EncontroAgendaWhereInput[] = [{ matricula: { alunoId: d.alunoId } }, ...alocacoes.map(v => {
    const inicio = v.provenienciaVinculo === "MIGRACAO" ? v.inicioVigencia! : v.criadoEm;
    const limites = [d.fim, v.encerradaEm, ...(v.provenienciaVinculo === "MIGRACAO" ? [v.fimVigencia] : [])].filter((data): data is Date => data != null);
    const fim = new Date(Math.min(...limites.map(data => data.getTime())));
    return { turmaId: v.turmaId, matriculaId: null, inicio: { lt: fim }, fim: { gt: inicio } };
  })];
  if (d.professorId) recursos.push({ professorId: d.professorId });
  const encontros = await tx.encontroAgenda.findMany({ where: { ...(d.ignorarEncontroId ? { id: { not: d.ignorarEncontroId } } : {}), status: { in: ["PREVISTO", "MINISTRADO"] }, inicio: { lt: d.fim }, fim: { gt: d.inicio }, OR: recursos }, select: { inicio: true, fim: true, professorId: true }, orderBy: [{ inicio: "asc" }, { id: "asc" }] });
  const indisponibilidades = d.professorId ? await tx.indisponibilidadeDocente.count({ where: { professorId: d.professorId, decisao: { aprovada: true }, inicio: { lt: d.fim }, fim: { gt: d.inicio } } }) : 0;
  const reservas = await tx.horarioReservaParticular.count({ where: { inicio: { lt: d.fim }, fim: { gt: d.inicio }, reserva: { status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } }, OR: [{ reserva: { matricula: { alunoId: d.alunoId } } }, ...(d.professorId ? [{ professorId: d.professorId }] : [])] } });
  return { encontros, indisponibilidades, reservas };
}
