import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { carregarConferenciaDesistenciaTx } from "./desistencia-conferencia-tx";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Fotografia de cobranças emitidas que podem ser canceladas integralmente.
 * Não calcula acerto: qualquer baixa, crédito, pausa ou tratamento incompatível sai
 * deste fluxo e exige tratamento financeiro posterior. */
export async function conferirCancelamentoFinanceiroDesistenciaTx(tx: Prisma.TransactionClient, pedidoId: string, estadoHash: string) {
  const pedido = await tx.pedidoDesistenciaPreparacao.findUnique({ where: { id: pedidoId }, select: { id: true, matriculaId: true, estadoHash: true } });
  if (!pedido || pedido.estadoHash !== estadoHash) throw new ErroRegra("Pedido ou conferência de desistência inválidos.");
  const conferencia = await carregarConferenciaDesistenciaTx(tx, pedido.matriculaId);
  if (!conferencia.resumo.podeRegistrar || conferencia.estadoHash !== pedido.estadoHash) throw new ErroRegra("A preparação mudou desde o pedido de desistência.");
  const r = conferencia.resumo;
  if (r.exigeAprovacaoAdministrativa || r.exigeConferenciaDocumental || r.quantidadeAlocacoes > 0 || r.financeiro.quantidadeCreditos > 0 || r.reservas.some(reserva => reserva.status === "UTILIZADA")) throw new ErroRegra("Este pedido exige tratamento financeiro ou documental específico.");
  const ultimo = await tx.pedidoDesistenciaPreparacao.findFirst({ where: { matriculaId: pedido.matriculaId }, orderBy: { versao: "desc" }, select: { id: true } });
  if (ultimo?.id !== pedido.id) throw new ErroRegra("Há pedido de desistência mais recente.");
  const cobrancas = await tx.cobranca.findMany({ where: { matriculaId: pedido.matriculaId }, orderBy: { id: "asc" }, include: {
    itemEmissaoEntrada: true, recebimentos: { select: { id: true } }, informes: { select: { status: true } }, utilizacoesCreditoPropostas: { select: { id: true } },
    compensacoesCobertura: { select: { id: true } }, ajusteAcerto: true, emissaoFechamentoHoras: true, comprasHoras: { select: { id: true } },
  } });
  if (!cobrancas.length) throw new ErroRegra("Não há cobranças emitidas para conferir.");
  const fotografia = cobrancas.map((c) => ({ id: c.id, versao: c.versao, status: c.status, valorOriginal: c.valorOriginal.toFixed(2), valorNegociado: c.valorNegociado.toFixed(2), saldoAnterior: c.saldo?.toFixed(2) ?? null, moeda: c.moeda, vencimento: c.vencimento.toISOString(), coberturaInicio: c.coberturaInicio?.toISOString() ?? null, coberturaFim: c.coberturaFim?.toISOString() ?? null, canceladaPorPausaId: c.canceladaPorPausaId, suspensaPorItemPausaId: c.suspensaPorItemPausaId, informes: c.informes.map(i => i.status).sort(), itemEmissaoId: c.itemEmissaoEntrada?.id ?? null }));
  for (const c of cobrancas) {
    const semMovimento = (c.valorRecebido === null || c.valorRecebido.isZero()) && c.valorLiquidadoCredito.isZero() && !c.pagoEm && !c.recebimentos.length && !c.informes.some(i => i.status !== "REJEITADO") && !c.utilizacoesCreditoPropostas.length && !c.compensacoesCobertura.length && !c.ajusteAcerto && !c.emissaoFechamentoHoras && !c.comprasHoras.length && !c.canceladaPorPausaId && !c.suspensaPorItemPausaId && !c.acertoMultaDecisaoId && !c.canceladaPorDesistenciaId && c.valorOriginal.gte(0) && c.valorNegociado.gte(0);
    const statusPermitido = ["PENDENTE", "ATRASADO", "CANCELADA"].includes(c.status);
    const saldoInteiro = c.saldo !== null && c.saldo.equals(c.valorNegociado);
    if (!semMovimento || !statusPermitido || !saldoInteiro) throw new ErroRegra("Há cobrança que exige acerto financeiro específico.");
  }
  if (await tx.aplicacaoPeriodoIntegral.count({ where: { cobrancaId: { in: cobrancas.map(c => c.id) } } })) throw new ErroRegra("Há tratamento de cobertura anterior que exige conferência específica.");
  return { pedido, fotografia, fotografiaHash: hash(fotografia), podeEfetivar: true as const };
}
