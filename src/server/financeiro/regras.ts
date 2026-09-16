import { Prisma, StatusCobranca, StatusMatricula } from "@prisma/client";
import { ErroRegra, ErroPermissao } from "@/server/_shared/sessao";

/** Dinheiro é calculado em decimal e arredondado uma única vez na borda. */
export function dinheiro(valor: Prisma.Decimal.Value): Prisma.Decimal {
  const n = new Prisma.Decimal(valor);
  if (!n.isFinite() || n.isNegative()) throw new ErroRegra("Valor monetário inválido.");
  return n.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function saldoAtual(negociado: Prisma.Decimal.Value, recebido: Prisma.Decimal.Value | null, liquidadoCredito: Prisma.Decimal.Value = 0) {
  return Prisma.Decimal.max(0, dinheiro(negociado).minus(dinheiro(recebido ?? 0)).minus(dinheiro(liquidadoCredito)));
}

export function descontoAcumulado(referencia: Prisma.Decimal.Value, proposto: Prisma.Decimal.Value) {
  const base = dinheiro(referencia);
  const valor = dinheiro(proposto);
  if (base.isZero()) return new Prisma.Decimal(0); // oferta gratuita não tem desconto a conceder
  return Prisma.Decimal.max(0, base.minus(valor).div(base).mul(100));
}

export function acimaDaAlcada(referencia: Prisma.Decimal.Value, proposto: Prisma.Decimal.Value, limite: Prisma.Decimal.Value | null) {
  return descontoAcumulado(referencia, proposto).gt(limite ?? 0);
}

export function exigirConferenciaIndependente(solicitanteId: string, conferenteId: string) {
  if (solicitanteId === conferenteId) {
    throw new ErroPermissao("A conferência exige outra pessoa, mesmo quando você acumula papéis.");
  }
}

export function validarEstadoAtivacao(status: StatusMatricula, taxaStatus: StatusCobranca) {
  if (status !== StatusMatricula.AGUARDANDO && status !== StatusMatricula.RASCUNHO) {
    throw new ErroRegra("Somente matrícula aguardando ativação pode ser ativada.");
  }
  if (taxaStatus === StatusCobranca.CANCELADA) throw new ErroRegra("Taxa cancelada não permite ativação.");
}

/** Quitação confirmada considera caixa e crédito aprovado separadamente; informe pendente não é liquidação. */
export function pagamentoConfirmado(cobranca: {
  status: StatusCobranca; valorNegociado: Prisma.Decimal.Value;
  valorRecebido: Prisma.Decimal.Value | null; pagoEm: Date | null;
  valorLiquidadoCredito?: Prisma.Decimal.Value;
}) {
  return cobranca.status === StatusCobranca.PAGO && cobranca.pagoEm !== null &&
    (cobranca.valorRecebido !== null || dinheiro(cobranca.valorLiquidadoCredito ?? 0).gt(0)) &&
    saldoAtual(cobranca.valorNegociado, cobranca.valorRecebido, cobranca.valorLiquidadoCredito ?? 0).isZero();
}

export function calcularPoliticaComissao(regra: {
  tipo: "PERCENTUAL" | "VALOR_FIXO";
  base: string;
  percentual: Prisma.Decimal.Value | null;
  valorFixo: Prisma.Decimal.Value | null;
  moeda: string;
}, taxa: Prisma.Decimal.Value, moeda: string) {
  if (regra.moeda !== moeda) throw new ErroRegra("Política de comissão incompatível com a moeda da matrícula.");
  if (regra.base !== "TAXA_MATRICULA") throw new ErroRegra("Base de comissão não suportada.");
  if (regra.tipo === "VALOR_FIXO") {
    if (regra.valorFixo === null || regra.percentual !== null) throw new ErroRegra("Política de valor fixo inválida.");
    return dinheiro(regra.valorFixo);
  }
  if (regra.percentual === null || regra.valorFixo !== null || new Prisma.Decimal(regra.percentual).gt(100)) {
    throw new ErroRegra("Política percentual inválida.");
  }
  return dinheiro(dinheiro(taxa).mul(dinheiro(regra.percentual)).div(100));
}
