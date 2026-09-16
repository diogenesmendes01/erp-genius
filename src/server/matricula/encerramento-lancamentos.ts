import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import type { calcularPreviaMensalConferida } from "./encerramento-previa-calculo";
import type { carregarHorasEncerramentoTx } from "./encerramento-horas-tx";
import { consolidarPreviaEncerramento } from "./encerramento-consolidacao";

/** Plano reproduzível por origem; não cria lançamentos nem comprova aprovação. */
export function prepararLancamentosEncerramento(mensal: ReturnType<typeof calcularPreviaMensalConferida>, horas: Awaited<ReturnType<typeof carregarHorasEncerramentoTx>>) {
  const consolidacao = consolidarPreviaEncerramento(mensal, horas);
  if (!consolidacao.totais) return { pendencias: consolidacao.pendencias, plano: null };
  const parcelas = mensal.compensacaoFinanceira.consolidado!.parcelas;
  const origens = [...mensal.origem.cobrancas, ...mensal.demaisCobrancas];
  const candidatos = [...parcelas.map(p => ({ cobrancaId: p.cobrancaId, valorDevido: p.valorServico, saldo: p.saldoDevido, credito: p.creditoApurado })),
    ...mensal.outrasCobrancasConferidas.parcelas.filter(p => consolidacao.cobrancasIndependentes.includes(p.cobrancaId)).map(p => ({ cobrancaId: p.cobrancaId, valorDevido: p.valorDevidoProposto, saldo: p.saldoDevido, credito: p.creditoApurado }))];
  if (new Set(candidatos.map(c => c.cobrancaId)).size !== candidatos.length) throw new ErroRegra("Cobrança repetida no plano de encerramento.");
  const ajustes = candidatos.map(c => {
    const origem = origens.find(o => o.id === c.cobrancaId);
    if (!origem || origem.moeda !== consolidacao.moeda) throw new ErroRegra("Origem incompatível no plano de encerramento.");
    return { ...c, versaoOrigem: origem.versao, valorNegociadoAnterior: origem.valorNegociado, valorRecebidoPreservado: origem.valorRecebido,
      valorLiquidadoCreditoPreservado: origem.valorLiquidadoCredito ?? "0.00", vencimentoPreservado: origem.vencimento };
  });
  const creditos = [...ajustes.filter(a => new Prisma.Decimal(a.credito).gt(0)).map(a => ({ origemTipo: "COBRANCA" as const, origemId: a.cobrancaId, valor: a.credito })),
    ...(horas.calculo?.compras ?? []).filter(c => new Prisma.Decimal(c.creditoApurado).gt(0)).map(c => ({ origemTipo: "COMPRA_HORAS" as const, origemId: c.compraId, valor: c.creditoApurado }))];
  const totalCredito = creditos.reduce((s, c) => s.plus(c.valor), new Prisma.Decimal(0));
  const totalDevido = ajustes.reduce((s, c) => s.plus(c.saldo), new Prisma.Decimal(consolidacao.totais.multaProposta));
  if (!totalCredito.equals(consolidacao.totais.creditoApuradoSemUtilizacao) || !totalDevido.equals(consolidacao.totais.saldoDevidoSemCompensarCreditos)) throw new ErroRegra("Lançamentos divergem da consolidação do acerto.");
  return { pendencias: [], plano: { matriculaId: mensal.calculo.matriculaId, moeda: consolidacao.moeda, dataEfetiva: mensal.calculo.dataEfetiva,
    ajustes, creditos, multa: { valorContratual: consolidacao.totais.multaContratual, valorProposto: consolidacao.totais.multaProposta, vencimento: mensal.conferencia.multa.tipo === "APLICAR" ? mensal.conferencia.multa.vencimento ?? null : null, origem: mensal.calculo.multa },
    comprasPreservadas: consolidacao.cobrancasTratadasPorCompra,
    horasALiquidar: (horas.calculo?.compras ?? []).filter(c => c.minutosPendentes > 0).map(c => ({ compraId: c.compraId, minutos: c.minutosPendentes, valor: c.creditoApurado })),
    compensacoes: mensal.compensacaoFinanceira.ajustes.map(a => ({ cobrancaId: a.cobrancaId, compensacaoIds: a.compensacaoIds, apuracao: a.apuracao })),
    totais: consolidacao.totais, efetivado: false as const } };
}
