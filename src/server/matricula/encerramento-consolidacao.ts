import { Prisma } from "@prisma/client";
import type { calcularPreviaMensalConferida } from "./encerramento-previa-calculo";
import type { carregarHorasEncerramentoTx } from "./encerramento-horas-tx";

/** Soma componentes sem utilizar créditos disponíveis nem executar ajustes. */
export function consolidarPreviaEncerramento(mensal: ReturnType<typeof calcularPreviaMensalConferida>, horas: Awaited<ReturnType<typeof carregarHorasEncerramentoTx>>) {
  const pendencias = [...mensal.compensacaoFinanceira.pendencias, ...mensal.outrasCobrancasConferidas.pendencias, ...horas.pendencias];
  const componenteMensal = mensal.compensacaoFinanceira.consolidado;
  if (!componenteMensal) pendencias.push("Componente mensal ainda não está conferido.");
  if (!horas.calculo) pendencias.push("Saldo das horas antecipadas ainda não está conferido.");
  const cobrancasCompras = new Set(horas.cobrancasCompras);
  const outras = mensal.outrasCobrancasConferidas.parcelas;
  for (const id of cobrancasCompras) {
    const p = outras.find(c => c.cobrancaId === id);
    if (!p || p.alteracaoProposta || !new Prisma.Decimal(p.saldoDevido).isZero() || !new Prisma.Decimal(p.creditoApurado).isZero()) {
      pendencias.push(`A cobrança ${id} origina compra de horas: preserve sua quitação e apure o saldo pela compra, sem ajuste duplicado.`);
    }
  }
  const independentes = outras.filter(c => !cobrancasCompras.has(c.cobrancaId));
  const somar = (campo: "saldoDevido" | "creditoApurado") => independentes.reduce((s, p) => s.plus(p[campo]), new Prisma.Decimal(0));
  const multaContratual = mensal.calculo.multa.valor;
  const multaProposta = mensal.propostaExcecaoMulta?.valorProposto ?? multaContratual;
  if (new Prisma.Decimal(multaProposta).gt(0) && (mensal.conferencia.multa.tipo !== "APLICAR" || !mensal.conferencia.multa.vencimento)) pendencias.push("Informe o vencimento da multa para aprovação antes de emitir a cobrança.");
  const saldoMensal = new Prisma.Decimal(componenteMensal?.saldoDevidoSemCompensarCreditos ?? 0).minus(multaContratual).plus(multaProposta);
  return { moeda: mensal.calculo.moeda, pendencias: [...new Set(pendencias)],
    cobrancasTratadasPorCompra: [...cobrancasCompras], cobrancasIndependentes: independentes.map(c => c.cobrancaId),
    totais: pendencias.length ? null : {
      saldoDevidoSemCompensarCreditos: saldoMensal.plus(somar("saldoDevido")).toFixed(2),
      creditoApuradoSemUtilizacao: new Prisma.Decimal(componenteMensal?.creditoApuradoSemUtilizacao ?? 0).plus(somar("creditoApurado")).plus(horas.calculo?.creditoApurado ?? 0).toFixed(2),
      multaContratual, multaProposta,
    }, exigeAprovacaoIndependente: true as const, efetivado: false as const };
}
