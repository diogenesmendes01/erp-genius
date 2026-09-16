import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/server/_shared/evento";

/** Rotina interna do cron; não é uma Server Action acessível por sessão. */
export async function iniciarTurmasDaAgenda(agora = new Date()) {
  if (!Number.isFinite(agora.getTime())) throw new Error("Instante inválido para processar início de turmas.");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
    const candidatas = await tx.turma.findMany({ where: { status: { in: ["PLANEJADA", "ABERTA"] },
      encontrosAgenda: { some: { finalidade: "AULA", status: { in: ["PREVISTO", "MINISTRADO"] }, inicio: { lte: agora } } } },
      orderBy: { id: "asc" }, take: 201, select: { id: true } });
    let iniciadas = 0;
    for (const candidata of candidatas.slice(0, 200)) {
      await tx.$queryRaw`SELECT id FROM "Turma" WHERE id = ${candidata.id} FOR UPDATE`;
      const turma = await tx.turma.findUniqueOrThrow({ where: { id: candidata.id }, select: { status: true } });
      if (turma.status !== "PLANEJADA" && turma.status !== "ABERTA") continue;
      const primeiro = await tx.encontroAgenda.findFirst({ where: { turmaId: candidata.id, finalidade: "AULA", status: { in: ["PREVISTO", "MINISTRADO"] } },
        orderBy: [{ inicio: "asc" }, { id: "asc" }], select: { id: true, inicio: true } });
      if (!primeiro || primeiro.inicio > agora) continue;
      await tx.turma.update({ where: { id: candidata.id }, data: { status: "EM_ANDAMENTO" } });
      await registrarEvento(tx, { tipo: "TurmaEmAndamento", agregadoTipo: "Turma", agregadoId: candidata.id, autorId: null,
        payload: { de: turma.status, para: "EM_ANDAMENTO", origem: "AGENDA", encontroId: primeiro.id,
          inicioEfetivo: primeiro.inicio.toISOString(), processadoEm: agora.toISOString() } });
      iniciadas++;
    }
    return { iniciadas, possuiMais: candidatas.length > 200 };
  }, { timeout: 20000 });
}
