import { Prisma, StatusCobranca, FormaPagamento } from "@prisma/client";
import { registrarEvento, ErroRegra, ErroPermissao } from "@/server/_shared";
import { dinheiro, saldoAtual } from "./regras";
import { createHash } from "node:crypto";

export function hashDadosPagamento(input: {
  cobrancaId: string; autorId: string; valorRecebido: number; forma: FormaPagamento;
  dataPagamento?: Date | null; comprovanteUrl?: string | null; comprovanteNome?: string | null;
  comentario?: string | null; permitirExcedente?: boolean;
}) {
  return createHash("sha256").update(JSON.stringify({
    cobrancaId: input.cobrancaId, autorId: input.autorId, valor: dinheiro(input.valorRecebido).toFixed(2),
    forma: input.forma, dataPagamento: input.dataPagamento?.toISOString() ?? null,
    comprovanteUrl: input.comprovanteUrl ?? null, comprovanteNome: input.comprovanteNome ?? null,
    comentario: input.comentario ?? null, permitirExcedente: input.permitirExcedente ?? false,
  })).digest("hex");
}

export async function bloquearCobranca(tx: Prisma.TransactionClient, id: string) {
  // Lock por objeto: duas baixas distintas não podem ler o mesmo acumulado.
  await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE id = ${id} FOR UPDATE`;
  const cobranca = await tx.cobranca.findUnique({ where: { id } });
  if (!cobranca) throw new ErroRegra("Cobrança não encontrada.");
  return cobranca;
}

/** Segue a ordem usada na assunção/documentos: lead, matrícula e depois cobranças. */
export async function bloquearMatriculas(tx: Prisma.TransactionClient, ids: string[]) {
  const matriculas = await tx.matricula.findMany({
    where: { id: { in: ids } }, select: { id: true, leadId: true },
  });
  const leads = [...new Set(matriculas.flatMap((matricula) => matricula.leadId ? [matricula.leadId] : []))].sort();
  for (const leadId of leads) await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${leadId} FOR UPDATE`;
  for (const matriculaId of [...new Set(ids)].sort()) await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${matriculaId} FOR UPDATE`;
}

export async function receberTx(tx: Prisma.TransactionClient, input: {
  cobrancaId: string;
  chaveIdempotencia: string;
  autorId: string;
  valorRecebido: number;
  forma: FormaPagamento;
  dataPagamento: Date;
  comprovanteUrl?: string | null;
  comprovanteNome?: string | null;
  comentario?: string | null;
  permitirExcedente?: boolean;
  informeId?: string;
  hashDados?: string;
  moeda?: string;
}) {
  const cobranca = await bloquearCobranca(tx, input.cobrancaId);
  if (input.moeda && input.moeda !== cobranca.moeda) throw new ErroRegra("A moeda do informe difere da cobrança. Confira novamente o pagamento.");
  const hashDados = input.hashDados ?? hashDadosPagamento(input);
  const existente = await tx.recebimento.findUnique({ where: { chaveIdempotencia: input.chaveIdempotencia } });
  if (existente) {
    if (existente.cobrancaId !== input.cobrancaId || existente.autorId !== input.autorId ||
        !existente.valor.equals(dinheiro(input.valorRecebido)) || existente.forma !== input.forma ||
        existente.informeId !== (input.informeId ?? null) || (existente.hashDados && existente.hashDados !== hashDados)) {
      throw new ErroRegra("Identificador de pagamento já usado para outra operação.");
    }
    return existente;
  }
  if (cobranca.status === StatusCobranca.CANCELADA || cobranca.status === StatusCobranca.PAGO) {
    throw new ErroRegra("Cobrança paga ou cancelada não recebe nova baixa.");
  }
  // Não permitir contornar a conferência do próprio informe através da baixa direta.
  if (!input.informeId && await tx.pagamentoInformado.count({ where: {
    cobrancaId: cobranca.id, autorId: input.autorId, status: "A_CONFERIR",
  } })) throw new ErroPermissao("Seu informe aguarda conferência de outra pessoa.");
  const valor = dinheiro(input.valorRecebido);
  if (valor.lte(0)) throw new ErroRegra("O valor recebido deve ser maior que zero.");
  const recebido = dinheiro(cobranca.valorRecebido ?? 0).plus(valor);
  const excedente = Prisma.Decimal.max(0, recebido.plus(cobranca.valorLiquidadoCredito).minus(cobranca.valorNegociado));
  if (excedente.gt(0) && !input.permitirExcedente) throw new ErroRegra("Valor recebido excede o saldo devido.");
  const saldo = saldoAtual(cobranca.valorNegociado, recebido, cobranca.valorLiquidadoCredito);
  const quitada = saldo.isZero();
  const recebimento = await tx.recebimento.create({ data: {
    chaveIdempotencia: input.chaveIdempotencia, cobrancaId: cobranca.id, informeId: input.informeId ?? null,
    autorId: input.autorId, valor, moeda: cobranca.moeda, forma: input.forma, dataPagamento: input.dataPagamento, hashDados,
  } });
  await tx.cobranca.update({ where: { id: cobranca.id }, data: {
    valorRecebido: recebido, saldo, versao: { increment: 1 },
    status: quitada ? StatusCobranca.PAGO : (cobranca.vencimento < new Date() ? StatusCobranca.ATRASADO : StatusCobranca.PENDENTE),
    pagoEm: quitada ? input.dataPagamento : null, formaPagamento: input.forma,
    comprovanteUrl: input.comprovanteUrl ?? null, comprovanteNome: input.comprovanteNome ?? null,
    comentario: input.comentario ?? null,
  } });
  await registrarEvento(tx, { tipo: "PagamentoRegistrado", agregadoTipo: "Cobranca", agregadoId: cobranca.id,
    autorId: input.autorId, payload: {
      recebimentoId: recebimento.id, informeId: input.informeId ?? null, valorRecebido: valor.toNumber(),
      recebidoAcumulado: recebido.toNumber(), saldo: saldo.toNumber(), excedente: excedente.toNumber(),
      forma: input.forma, quitada, dataPagamento: input.dataPagamento.toISOString(),
      comprovanteUrl: input.comprovanteUrl ?? null, comprovanteNome: input.comprovanteNome ?? null,
    },
  });
  return recebimento;
}
