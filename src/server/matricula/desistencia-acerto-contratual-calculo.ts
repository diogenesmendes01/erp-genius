import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { RegrasEncerramentoSchema } from "./condicoes-encerramento-schema";

/** Calcula somente a obrigação final prevista na versão contratual aprovada.
 * Recebimentos são entrada do cálculo e permanecem imutáveis. */
export function calcularObrigacaoDesistenciaContratual(regrasEntrada: unknown, cobranca: { valorNegociado: Prisma.Decimal | string | number; valorRecebido: Prisma.Decimal | string | number | null; valorLiquidadoCredito: Prisma.Decimal | string | number }) {
  const regra = RegrasEncerramentoSchema.parse(regrasEntrada).acertoDesistenciaPreparacao;
  if (!regra) throw new ErroRegra("O contrato confirmado não traz regra estruturada para o acerto da desistência; complemente e confira as condições.");
  const contratado = new Prisma.Decimal(cobranca.valorNegociado);
  const recebido = new Prisma.Decimal(cobranca.valorRecebido ?? 0).plus(cobranca.valorLiquidadoCredito);
  const devido = regra.tipo === "VALOR_FIXO" ? new Prisma.Decimal(regra.valor) : contratado.mul(regra.percentual).div(100);
  const saldoDevido = Prisma.Decimal.max(devido.minus(recebido), 0);
  const creditoApurado = Prisma.Decimal.max(recebido.minus(devido), 0);
  return { devido: devido.toDecimalPlaces(2), saldoDevido: saldoDevido.toDecimalPlaces(2), creditoApurado: creditoApurado.toDecimalPlaces(2), clausulaId: regra.clausulaId, condicoesAplicacao: regra.condicoesAplicacao };
}
