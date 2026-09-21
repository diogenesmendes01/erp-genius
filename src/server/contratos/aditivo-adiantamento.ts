import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { validarValorAlteracaoAditivo } from "./aditivo-valores";

export const CAMPOS_ADIANTAMENTO = ["ADIANTAMENTO_VALOR", "ADIANTAMENTO_MINUTOS", "ADIANTAMENTO_VENCIMENTO"] as const;

/** Minutos vigentes: última aplicação de aditivo; sem ela, os da emissão inicial. Espelha minutos_adiantamento_vigentes_172. */
export async function minutosAdiantamentoVigentesTx(tx: Prisma.TransactionClient, matriculaId: string, cobrancaId: string) {
  const [linha] = await tx.$queryRaw<Array<{ minutos: number | null }>>`SELECT minutos_adiantamento_vigentes_172(${matriculaId},${cobrancaId}) AS minutos`;
  return linha?.minutos ?? null;
}

/**
 * Q172: identifica o adiantamento pela emissão inicial e só o declara aplicável enquanto não
 * pago nem utilizado. Condição formalizada define o novo valor; condição ausente preserva o atual.
 */
export async function consultarAlvoAdiantamentoTx(tx: Prisma.TransactionClient, matriculaId: string, condicoes: unknown) {
  const c = z.record(z.unknown()).parse(condicoes);
  const valor = c.ADIANTAMENTO_VALOR === undefined ? null : validarValorAlteracaoAditivo("ADIANTAMENTO_VALOR", c.ADIANTAMENTO_VALOR);
  const minutos = c.ADIANTAMENTO_MINUTOS === undefined ? null : validarValorAlteracaoAditivo("ADIANTAMENTO_MINUTOS", c.ADIANTAMENTO_MINUTOS);
  const vencimento = c.ADIANTAMENTO_VENCIMENTO === undefined ? null : validarValorAlteracaoAditivo("ADIANTAMENTO_VENCIMENTO", c.ADIANTAMENTO_VENCIMENTO);
  if ((valor && valor.tipo !== "DINHEIRO") || (minutos && minutos.tipo !== "MINUTOS") || (vencimento && vencimento.tipo !== "DATA")) throw new ErroRegra("Condição contratual do adiantamento inválida.");
  const proposto = {
    valor: valor?.tipo === "DINHEIRO" ? { valor: valor.valor, moeda: valor.moeda } : null,
    minutos: minutos?.tipo === "MINUTOS" ? minutos.minutos : null,
    vencimento: vencimento?.tipo === "DATA" ? vencimento.data : null,
  };
  const itens = await tx.itemEmissaoEntrada.findMany({ where: { matriculaId, cobranca: { tipo: "HORA_PARTICULAR" } }, take: 2, select: { cobrancaId: true } });
  if (itens.length !== 1) return { proposto, podePreparar: false, cobranca: null, pendencia: itens.length
    ? "A emissão identifica mais de um adiantamento. Confira a origem antes do acerto."
    : "Este contrato não possui adiantamento emitido na entrada. As novas condições valem para a próxima contratação de horas." };
  const cobranca = await tx.cobranca.findUniqueOrThrow({ where: { id: itens[0].cobrancaId }, select: {
    id: true, matriculaId: true, versao: true, status: true, moeda: true, vencimento: true, valorNegociado: true, valorRecebido: true, valorLiquidadoCredito: true, pagoEm: true,
    suspensaPorItemPausaId: true, canceladaPorPausaId: true,
    _count: { select: { destinacoesRecebimento: true, comprasHoras: true } },
  } });
  if (cobranca.matriculaId !== matriculaId) throw new ErroRegra("O adiantamento pertence a outro contrato.");
  const [informes, usosCredito, ajustes] = await Promise.all([
    tx.pagamentoInformado.count({ where: { cobrancaId: cobranca.id, status: "A_CONFERIR" } }),
    tx.propostaUsoCredito.count({ where: { cobrancaId: cobranca.id, OR: [{ decisao: null }, { decisao: { aprovada: true } }] } }),
    tx.ajusteCobrancaAcerto.count({ where: { cobrancaId: cobranca.id } }),
  ]);
  const minutosAtuais = await minutosAdiantamentoVigentesTx(tx, matriculaId, cobranca.id);
  const base = { proposto, cobranca: { id: cobranca.id, versao: cobranca.versao, moeda: cobranca.moeda, valorAtual: cobranca.valorNegociado.toFixed(2), vencimentoAtual: cobranca.vencimento, minutosAtuais } };
  const recusa = (pendencia: string) => ({ ...base, podePreparar: false, pendencia });
  if (cobranca._count.comprasHoras) return recusa("As horas deste adiantamento já foram registradas ou utilizadas. O aditivo não alcança adiantamento utilizado; trate a diferença em nova contratação de horas.");
  if (!["PENDENTE", "ATRASADO"].includes(cobranca.status) || !new Prisma.Decimal(cobranca.valorRecebido ?? 0).isZero() || !cobranca.valorLiquidadoCredito.isZero() || cobranca.pagoEm || cobranca._count.destinacoesRecebimento || usosCredito)
    return recusa("O adiantamento já recebeu pagamento ou crédito. O aditivo não alcança adiantamento pago; trate a diferença em nova contratação de horas.");
  if (informes) return recusa("Há comprovante de pagamento deste adiantamento aguardando conferência. Conclua a conferência antes do acerto.");
  if (cobranca.suspensaPorItemPausaId || cobranca.canceladaPorPausaId || ajustes) return recusa("A cobrança está em pausa ou possui acerto e exige conferência financeira específica.");
  if (minutosAtuais === null) return recusa("Os minutos contratados do adiantamento não foram identificados na emissão inicial.");
  if (proposto.valor && proposto.valor.moeda !== cobranca.moeda) return recusa("A moeda do novo valor difere da moeda da cobrança. Mudança de moeda possui fluxo próprio.");
  return { ...base, podePreparar: true, pendencia: "O adiantamento exige proposta de acerto e aprovação financeira independente antes da aplicação." };
}
