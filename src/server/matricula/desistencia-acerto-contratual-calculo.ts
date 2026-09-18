import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { RegrasEncerramentoSchema } from "./condicoes-encerramento-schema";

/** Calcula somente a obrigação final prevista na versão contratual aprovada.
 * Recebimentos são entrada do cálculo e permanecem imutáveis. */
export function calcularObrigacaoDesistenciaContratual(regrasEntrada: unknown, cobranca: { id: string; tipo: string; valorNegociado: Prisma.Decimal | string | number; valorRecebido: Prisma.Decimal | string | number | null; valorLiquidadoCredito: Prisma.Decimal | string | number; valorCompensadoPermuta?: Prisma.Decimal | string | number; valorCreditoJaApurado?: Prisma.Decimal | string | number }, cobrancasDaContratacao: { id: string; tipo: string; valorNegociado: Prisma.Decimal | string | number }[] = [cobranca]) {
  const regra = RegrasEncerramentoSchema.parse(regrasEntrada).acertoDesistenciaPreparacao;
  if (!regra) throw new ErroRegra("O contrato confirmado não traz regra estruturada para o acerto da desistência; complemente e confira as condições.");
  const condicoes = regra.condicoesAplicacao;
  const alcança = condicoes.unidade === "POR_COBRANCA"
    ? condicoes.alcance.tipo === "TODAS_COBRANCAS_MATRICULA" || (condicoes.alcance.tipo === "TIPOS_COBRANCA" ? condicoes.alcance.tipos.includes(cobranca.tipo as never) : condicoes.alcance.cobrancaIds.includes(cobranca.id))
    : condicoes.cobrancaIds.includes(cobranca.id);
  if (!alcança) throw new ErroRegra("A cobrança não está no alcance contratual do acerto de desistência.");
  if (new Prisma.Decimal(cobranca.valorCompensadoPermuta ?? 0).gt(0)) throw new ErroRegra("Compensação por permuta exige destinação negociada e aprovação própria.");
  if (condicoes.unidade === "TOTAL_CONTRATACAO") {
    const idsContrato = [...condicoes.cobrancaIds].sort();
    const idsFontes = cobrancasDaContratacao.map(x => x.id).sort();
    const fonteDaCobranca = cobrancasDaContratacao.find(x => x.id === cobranca.id);
    if (new Set(idsFontes).size !== idsFontes.length || idsContrato.length !== idsFontes.length || idsContrato.some((id, i) => id !== idsFontes[i]) || !fonteDaCobranca || fonteDaCobranca.tipo !== cobranca.tipo || !new Prisma.Decimal(fonteDaCobranca.valorNegociado).eq(cobranca.valorNegociado)) throw new ErroRegra("O conjunto de cobranças da contratação diverge do alcance contratual aprovado.");
  }
  const contratado = new Prisma.Decimal(cobranca.valorNegociado);
  const liquidadoOriginal = new Prisma.Decimal(cobranca.valorRecebido ?? 0).plus(cobranca.valorLiquidadoCredito);
  // Excedentes anteriormente convertidos em crédito continuam registrados e
  // não podem ser novamente destinados no acerto desta mesma cobrança.
  const creditoAnterior = new Prisma.Decimal(cobranca.valorCreditoJaApurado ?? 0);
  if (!creditoAnterior.isFinite() || creditoAnterior.lt(0) || creditoAnterior.gt(liquidadoOriginal)) {
    throw new ErroRegra("Confira os créditos já apurados e a liquidação original da cobrança.");
  }
  const recebido = liquidadoOriginal.minus(creditoAnterior);
  const totalContratacao = cobrancasDaContratacao.reduce((s, x) => s.plus(x.valorNegociado), new Prisma.Decimal(0));
  const base = condicoes.unidade === "POR_COBRANCA" ? contratado : totalContratacao;
  const totalDevido = (regra.tipo === "VALOR_FIXO" ? new Prisma.Decimal(regra.valor) : base.mul(regra.percentual).div(100)).toDecimalPlaces(2);
  const devido = condicoes.unidade === "POR_COBRANCA" ? totalDevido : (() => {
    const rateioOrdenado = [...condicoes.rateio].sort((a, b) => a.cobrancaId.localeCompare(b.cobrancaId));
    const quotas = rateioOrdenado.map(x => { const bruto = totalDevido.mul(x.percentual).div(100); return { id: x.cobrancaId, valor: bruto.toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN), resto: bruto.minus(bruto.toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN)) }; });
    let centavosRestantes = totalDevido.minus(quotas.reduce((s, x) => s.plus(x.valor), new Prisma.Decimal(0))).mul(100).toNumber();
    for (const quota of [...quotas].sort((a, b) => b.resto.comparedTo(a.resto) || a.id.localeCompare(b.id))) { if (centavosRestantes-- <= 0) break; quota.valor = quota.valor.plus(0.01); }
    return quotas.find(x => x.id === cobranca.id)?.valor ?? new Prisma.Decimal(-1);
  })();
  const saldoDevido = Prisma.Decimal.max(devido.minus(recebido), 0);
  const creditoApurado = Prisma.Decimal.max(recebido.minus(devido), 0);
  return { devido: devido.toDecimalPlaces(2), saldoDevido: saldoDevido.toDecimalPlaces(2), creditoApurado: creditoApurado.toDecimalPlaces(2), creditoAnterior: creditoAnterior.toDecimalPlaces(2), liquidacaoLiquida: recebido.toDecimalPlaces(2), clausulaId: regra.clausulaId, condicoesAplicacao: regra.condicoesAplicacao };
}
