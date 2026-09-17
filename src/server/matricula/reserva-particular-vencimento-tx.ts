import type { Prisma } from "@prisma/client";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { resolverReservaParticularAtual } from "./reserva-particular-cadeia";

/** Executor interno para Secretaria/rotina autenticada. Chamador autoriza o executor.
 * Resultado externo incerto nunca autoriza liberação dos horários. */
export async function conferirVencimentoParticularTx(tx: Prisma.TransactionClient, reservaId: string, autorId: string | null = null) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const referencia = await tx.reservaAgendaParticular.findUnique({ where: { id: reservaId }, select: { matriculaId: true } });
  if (!referencia) throw new ErroRegra("Reserva particular não encontrada.");
  await bloquearMatriculas(tx, [referencia.matriculaId]);
  await tx.$queryRaw`SELECT id FROM "ReservaAgendaParticular" WHERE id = ${reservaId} FOR UPDATE`;
  const reserva = await tx.reservaAgendaParticular.findUniqueOrThrow({ where: { id: reservaId } });
  if (reserva.status !== "ATIVA") return { reservaId, status: reserva.status, resultado: "SEM_TRANSICAO" as const };
  const agora = new Date();
  if (reserva.expiraEm > agora) return { reservaId, status: reserva.status, resultado: "PRAZO_VIGENTE" as const };
  const m = await tx.matricula.findUniqueOrThrow({ where: { id: reserva.matriculaId }, select: {
    status: true, contratoOk: true, confirmacaoContratoEm: true, contratoDocumentoId: true,
    preparacaoComercial: { select: { reservaParticularId: true } },
  } });
  const informes = await tx.pagamentoInformado.findMany({ where: { cobranca: { matriculaId: reserva.matriculaId }, status: { in: ["A_CONFERIR", "CONFIRMADO"] } }, select: { id: true }, orderBy: { id: "asc" } });
  const recebimentos = await tx.recebimento.findMany({ where: { titularMatriculaId: reserva.matriculaId }, select: { id: true }, orderBy: { id: "asc" } });
  const indicacoes = await tx.cobranca.findMany({ where: { matriculaId: reserva.matriculaId, OR: [{ valorRecebido: { gt: 0 } }, { pagoEm: { not: null } }, { status: "PAGO" }] }, select: { id: true }, orderBy: { id: "asc" } });
  // Mesmo um processo cancelado exige conciliação: cancelamento não prova ausência
  // de assinaturas parciais, nem substitui o tratamento dos documentos/valores.
  const processos = await tx.processoAssinaturaContratual.findMany({ where: { matriculaId: reserva.matriculaId }, select: { id: true, estado: true }, orderBy: { id: "asc" } });
  const documentos = await tx.documento.findMany({ where: { matriculaId: reserva.matriculaId, categoria: "CONTRATO" }, select: { id: true }, orderBy: { id: "asc" } });
  const evidenciaContrato = m.contratoOk || !!m.confirmacaoContratoEm || !!m.contratoDocumentoId;
  const inicialId = m.preparacaoComercial?.reservaParticularId;
  const atualId = inicialId ? await resolverReservaParticularAtual(tx, inicialId) : null;
  const exigeConferencia = !["RASCUNHO", "AGUARDANDO"].includes(m.status) || atualId !== reservaId;
  const manter = !!(informes.length || recebimentos.length || indicacoes.length || processos.length || documentos.length || evidenciaContrato || exigeConferencia);
  const status = manter ? "MANTIDA_PENDENCIA" as const : "EXPIRADA" as const;
  await tx.reservaAgendaParticular.update({ where: { id: reservaId }, data: { status } });
  await registrarEvento(tx, { tipo: manter ? "ReservaParticularMantidaPorPendencia" : "ReservaParticularExpirada", agregadoTipo: "Matricula", agregadoId: reserva.matriculaId, autorId,
    payload: { reservaId, expiraEm: reserva.expiraEm.toISOString(), conferidoEm: agora.toISOString(), informesIds: informes.map((r) => r.id), recebimentosIds: recebimentos.map((r) => r.id), cobrancasComIndicacaoIds: indicacoes.map((r) => r.id), processos, documentosIds: documentos.map((r) => r.id), evidenciaContrato, exigeConferencia, situacaoMatricula: m.status } });
  return { reservaId, status, resultado: manter ? "PENDENCIA_REGISTRADA" as const : "HORARIOS_LIBERADOS" as const };
}
