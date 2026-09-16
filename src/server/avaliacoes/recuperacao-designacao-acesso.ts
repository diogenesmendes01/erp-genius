import { Prisma } from "@prisma/client";

/** Chamador bloqueia a matrícula e revalida usuário/papel. Designação não abre o plano. */
export async function designadoRecuperacao(tx: Prisma.TransactionClient, itemReservaId: string, professorId: string, naData?: Date) {
  const item = await tx.itemReservaTentativaRecuperacao.findUnique({ where: { id: itemReservaId }, select: { realizacao: { select: { notas: { where: { decisao: { aprovada: true } }, take: 1, select: { id: true } } } }, reserva: { select: { cancelamento: { select: { id: true } } } } } });
  if (!item || item.realizacao?.notas.length || (item.reserva.cancelamento && !item.realizacao)) return false;
  const atual = await tx.designacaoRecuperacao.findFirst({ where: { itemReservaId }, orderBy: { versao: "desc" }, select: { professorId: true } });
  if (atual?.professorId !== professorId) return false;
  if (naData) {
    const historica = await tx.designacaoRecuperacao.findFirst({ where: { itemReservaId, criadaEm: { lte: naData } }, orderBy: { versao: "desc" }, select: { professorId: true } });
    return historica?.professorId === professorId;
  }
  return true;
}
