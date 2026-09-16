import { prisma } from "@/lib/prisma";

/** Avança antes de processar: uma falha/queda será revisitada na próxima volta,
 * sem prender as reservas posteriores. Cursor não concede liberação da reserva. */
export async function proximaReservaParticularVencida() {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('cursor-reservas-particulares', 0))`;
    const cursor = await tx.cursorVencimentoParticular.upsert({ where: { id: "escola" }, create: { id: "escola" }, update: {} });
    const reserva = await tx.reservaAgendaParticular.findFirst({
      where: { status: "ATIVA", expiraEm: { lte: new Date() },
        ...(cursor.ultimaExpiraEm && cursor.ultimoId ? { OR: [
          { expiraEm: { gt: cursor.ultimaExpiraEm } },
          { expiraEm: cursor.ultimaExpiraEm, id: { gt: cursor.ultimoId } },
        ] } : {}),
      }, orderBy: [{ expiraEm: "asc" }, { id: "asc" }], select: { id: true, expiraEm: true },
    });
    await tx.cursorVencimentoParticular.update({ where: { id: "escola" }, data: {
      ultimoId: reserva?.id ?? null, ultimaExpiraEm: reserva?.expiraEm ?? null,
    } });
    return reserva;
  }, { timeout: 5000, maxWait: 1000 });
}
