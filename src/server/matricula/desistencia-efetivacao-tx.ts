import { Papel, Prisma } from "@prisma/client";
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

/** Confere o ramo contratual depois de a aplicação Q165 ter alterado as
 * cobranças. Não reaproveita a conferência simples, cuja fotografia financeira
 * é propositalmente anterior à aplicação. A decisão administrativa continua
 * ligada ao pedido original e as solicitações de assinatura devem estar
 * concluídas antes da efetivação. */
export async function conferirEfetivacaoDesistenciaAcertoContratualTx(
  tx: Prisma.TransactionClient,
  aplicacaoId: string,
  pedidoId: string,
  estadoHashInformado: string,
) {
  const aplicacao = await tx.aplicacaoAcertoDesistenciaContratual.findUnique({
    where: { id: aplicacaoId },
    select: {
      id: true,
      decisao: { select: {
        aprovada: true,
        proposta: { select: { pedidoId: true, estadoHash: true } },
      } },
    },
  });
  if (!aplicacao?.decisao.aprovada || aplicacao.decisao.proposta.pedidoId !== pedidoId ||
    aplicacao.decisao.proposta.estadoHash !== estadoHashInformado) {
    throw new ErroRegra("A aplicação contratual não está aprovada para este pedido.");
  }

  const pedido = await tx.pedidoDesistenciaPreparacao.findUnique({
    where: { id: pedidoId },
    select: {
      id: true, matriculaId: true, versao: true, estadoHash: true, registradorId: true,
      decisaoAdministrativa: { select: { aprovada: true, estadoHash: true, decisorId: true } },
    },
  });
  if (!pedido || pedido.estadoHash !== estadoHashInformado) {
    throw new ErroRegra("O pedido não corresponde à conferência informada.");
  }
  const [ultimo, administrador, processos] = await Promise.all([
    tx.pedidoDesistenciaPreparacao.findFirst({
      where: { matriculaId: pedido.matriculaId }, orderBy: [{ versao: "desc" }, { id: "desc" }], select: { id: true },
    }),
    pedido.decisaoAdministrativa
      ? tx.usuario.findUnique({ where: { id: pedido.decisaoAdministrativa.decisorId }, select: { ativo: true, papeis: true } })
      : Promise.resolve(null),
    tx.processoAssinaturaContratual.findMany({
      where: { matriculaId: pedido.matriculaId },
      select: {
        id: true, estado: true, referenciaExterna: true,
        conclusao: { select: { id: true } },
        intencaoCancelamento: { select: {
          processoId: true, referenciaExterna: true, propostaHash: true,
          proposta: { select: { id: true, processoFonteId: true, matriculaId: true, preparadaPorId: true, entradaHash: true } },
          decisao: { select: { propostaId: true, aprovada: true, decisorId: true, propostaHash: true } },
          aplicacao: { select: { observacaoId: true, propostaHash: true } },
          observacoes: { select: { id: true, resultado: true, referenciaExterna: true } },
        } },
      },
    }),
  ]);
  if (ultimo?.id !== pedido.id) throw new ErroRegra("Há uma conferência de desistência mais recente.");
  if (!pedido.decisaoAdministrativa?.aprovada || pedido.decisaoAdministrativa.estadoHash !== pedido.estadoHash ||
    pedido.decisaoAdministrativa.decisorId === pedido.registradorId || !administrador?.ativo ||
    !administrador.papeis.includes(Papel.ADMINISTRADOR)) {
    throw new ErroRegra("A efetivação contratual exige decisão administrativa aprovada e independente.");
  }
  const assinaturasPendentes = processos.filter((processo) => {
    if (processo.conclusao) return false;
    const intencao = processo.intencaoCancelamento;
    const observacao = intencao?.aplicacao && intencao.observacoes.find((item) => item.id === intencao.aplicacao?.observacaoId);
    const cancelamentoComprovado = processo.estado === "CANCELADO" && !!intencao &&
      intencao.processoId === processo.id && intencao.referenciaExterna === processo.referenciaExterna &&
      intencao.proposta.processoFonteId === processo.id && intencao.proposta.matriculaId === pedido.matriculaId &&
      intencao.propostaHash === intencao.proposta.entradaHash && intencao.decisao.propostaId === intencao.proposta.id &&
      intencao.decisao.aprovada && intencao.decisao.decisorId !== intencao.proposta.preparadaPorId &&
      intencao.decisao.propostaHash === intencao.proposta.entradaHash &&
      intencao.aplicacao?.propostaHash === intencao.propostaHash && observacao?.resultado === "CONFIRMADO" &&
      observacao.referenciaExterna === intencao.referenciaExterna;
    return !cancelamentoComprovado;
  });
  if (assinaturasPendentes.length) {
    throw new ErroRegra("Há solicitação de assinatura sem conclusão confirmada. Regularize-a antes de efetivar.");
  }
  return { pedido };
}
