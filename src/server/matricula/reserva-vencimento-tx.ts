import type { Prisma } from "@prisma/client";
import { ErroRegra, registrarEvento } from "@/server/_shared";

/** Protege avanço conhecido no ERP. Ausência de evidência local não comprova ausência de assinatura externa. */
export async function conferirVencimentoReservaTx(tx: Prisma.TransactionClient, reservaId: string, conferenteId: string | null = null) {
  const referencia = await tx.reservaVagaMatricula.findUnique({ where: { id: reservaId }, select: { matriculaId: true, turmaId: true } });
  if (!referencia) throw new ErroRegra("Reserva não encontrada.");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${referencia.matriculaId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Turma" WHERE id = ${referencia.turmaId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "ReservaVagaMatricula" WHERE id = ${reservaId} FOR UPDATE`;
  const reserva = await tx.reservaVagaMatricula.findUniqueOrThrow({ where: { id: reservaId } });
  if (reserva.status !== "ATIVA") return { reservaId, status: reserva.status, resultado: "SEM_TRANSICAO" as const };
  const agora = new Date();
  if (reserva.expiraEm > agora) return { reservaId, status: reserva.status, resultado: "PRAZO_VIGENTE" as const };
  const m = await tx.matricula.findUniqueOrThrow({ where: { id: reserva.matriculaId }, select: { status: true, contratoOk: true, confirmacaoContratoEm: true, contratoDocumentoId: true } });
  const informes = await tx.pagamentoInformado.findMany({ where: { cobranca: { matriculaId: reserva.matriculaId }, status: { in: ["A_CONFERIR", "CONFIRMADO"] } }, select: { id: true }, orderBy: { id: "asc" } });
  const recebimentos = await tx.recebimento.findMany({ where: { cobranca: { matriculaId: reserva.matriculaId } }, select: { id: true }, orderBy: { id: "asc" } });
  // Indicadores legados também impedem liberação, sem inventar um novo recebimento.
  const cobrancasComIndicacao = await tx.cobranca.findMany({ where: { matriculaId: reserva.matriculaId, OR: [{ valorRecebido: { gt: 0 } }, { pagoEm: { not: null } }, { status: "PAGO" }] }, select: { id: true }, orderBy: { id: "asc" } });
  const evidenciaContrato = m.contratoOk || !!m.confirmacaoContratoEm || !!m.contratoDocumentoId;
  const situacaoExigeConferencia = !["RASCUNHO", "AGUARDANDO"].includes(m.status);
  if (!informes.length && !recebimentos.length && !cobrancasComIndicacao.length && !evidenciaContrato && !situacaoExigeConferencia) {
    return { reservaId, status: reserva.status, resultado: "CONFERIR_ASSINATURA_EXTERNA" as const };
  }
  await tx.reservaVagaMatricula.update({ where: { id: reservaId }, data: { status: "MANTIDA_PENDENCIA" } });
  await registrarEvento(tx, { tipo: "ReservaMantidaPorPendencia", agregadoTipo: "Matricula", agregadoId: reserva.matriculaId, autorId: conferenteId,
    payload: { reservaId, turmaId: reserva.turmaId, expiraEm: reserva.expiraEm.toISOString(), conferidoEm: agora.toISOString(),
      informesIds: informes.map((r) => r.id), recebimentosIds: recebimentos.map((r) => r.id), cobrancasComIndicacaoIds: cobrancasComIndicacao.map((r) => r.id),
      evidenciaContrato, situacaoMatricula: m.status } });
  return { reservaId, status: "MANTIDA_PENDENCIA" as const, resultado: "PENDENCIA_REGISTRADA" as const };
}
