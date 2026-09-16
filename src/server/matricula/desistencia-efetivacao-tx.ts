import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { carregarConferenciaDesistenciaTx } from "./desistencia-conferencia-tx";

/** Confere a única modalidade que esta aplicação pode encerrar: preparação sem
 * qualquer avanço formal. Casos mais ricos permanecem no pedido preparatório
 * até receberem o fluxo de acerto próprio. */
export async function conferirEfetivacaoDesistenciaPreparacaoTx(
  tx: Prisma.TransactionClient,
  pedidoId: string,
  estadoHashInformado: string,
  permitirCobrancas = false,
) {
  const pedido = await tx.pedidoDesistenciaPreparacao.findUnique({
    where: { id: pedidoId },
    select: { id: true, matriculaId: true, versao: true, estadoHash: true },
  });
  if (!pedido) throw new ErroRegra("Pedido de desistência não encontrado.");
  if (pedido.estadoHash !== estadoHashInformado) throw new ErroRegra("O pedido não corresponde à conferência informada.");

  const conferencia = await carregarConferenciaDesistenciaTx(tx, pedido.matriculaId);
  if (!conferencia.resumo.podeRegistrar) throw new ErroRegra("A matrícula não está mais em preparação.");
  if (conferencia.estadoHash !== pedido.estadoHash) throw new ErroRegra("A preparação mudou. Registre uma nova conferência antes de efetivar.");

  const [ultimo, creditos, documentos, processos, alocacoes, reservasColetivas, reservasParticulares] = await Promise.all([
    tx.pedidoDesistenciaPreparacao.findFirst({ where: { matriculaId: pedido.matriculaId }, orderBy: { versao: "desc" }, select: { id: true } }),
    tx.creditoMatricula.count({ where: { matriculaId: pedido.matriculaId } }),
    tx.documento.count({ where: { matriculaId: pedido.matriculaId } }),
    tx.processoAssinaturaContratual.count({ where: { matriculaId: pedido.matriculaId } }),
    tx.alocacaoTurma.count({ where: { matriculaId: pedido.matriculaId } }),
    tx.reservaVagaMatricula.findMany({ where: { matriculaId: pedido.matriculaId }, orderBy: { id: "asc" }, select: { id: true, status: true } }),
    tx.reservaAgendaParticular.findMany({ where: { matriculaId: pedido.matriculaId }, orderBy: { id: "asc" }, select: { id: true, status: true } }),
  ]);
  if (ultimo?.id !== pedido.id) throw new ErroRegra("Há uma conferência de desistência mais recente.");
  if (conferencia.resumo.exigeAprovacaoAdministrativa || conferencia.resumo.exigeConferenciaDocumental ||
    (!permitirCobrancas && conferencia.resumo.financeiro.exigeConferenciaFinanceira) || creditos || documentos || processos || alocacoes) {
    throw new ErroRegra("Este pedido exige conferência e acerto antes da efetivação.");
  }
  const reservas = [...reservasColetivas, ...reservasParticulares];
  if (reservas.some((reserva) => reserva.status === "UTILIZADA")) throw new ErroRegra("Há reserva utilizada; siga o fluxo de acerto.");
  if (reservas.some((reserva) => !["ATIVA", "MANTIDA_PENDENCIA", "EXPIRADA", "LIBERADA"].includes(reserva.status))) {
    throw new ErroRegra("Há reserva em estado incompatível com a efetivação.");
  }
  return { pedido, conferencia, reservasColetivas, reservasParticulares };
}
