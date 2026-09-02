import type { FormaPagamento, Prisma } from "@prisma/client";
import { StatusCobranca, TipoCobranca } from "@prisma/client";
import { acumularPagamento, ErroRegra, numero, numeroOuNull, registrarEvento } from "@/server/_shared";
import { ativarSeFechamentoCompletoTx } from "@/server/matricula/acoes";

// BAIXA COMPARTILHADA (Fase 2): o MESMO miolo para a baixa manual (registrarPagamento),
// a conciliação automática do gateway (webhook/página simulada) e a fatura B2B (baixa em
// lote). Acumula parciais, nunca sobrescreve o recebido, grava `PagamentoRegistrado` e,
// quando quita uma TAXA de matrícula, dispara a matrícula automática (C4) na mesma tx.

export interface DadosBaixa {
  valorRecebido: number;
  forma: FormaPagamento;
  dataPagamento?: Date | null;
  comprovanteUrl?: string | null;
  comprovanteNome?: string | null;
  comentario?: string | null;
  permitirExcedente?: boolean;
  /** Origem da baixa no evento: "manual" | "gateway_simulado" | "fatura_b2b"... */
  via: string;
}

export interface ResultadoBaixa {
  quitada: boolean;
  recebidoTotal: number;
  saldo: number;
  matriculaAtivada: boolean;
}

export async function baixarCobrancaTx(
  tx: Prisma.TransactionClient,
  autorId: string | null,
  cobrancaId: string,
  dados: DadosBaixa,
): Promise<ResultadoBaixa> {
  // LOCK DE LINHA (review PR #60): a acumulação é read-modify-write — sem serializar, duas
  // baixas concorrentes leem o MESMO `valorRecebido` e a segunda sobrescreve a primeira
  // (dois eventos, um só crédito). O `FOR UPDATE` faz a transação concorrente esperar aqui,
  // então a leitura abaixo já enxerga o acumulado da outra baixa.
  await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE id = ${cobrancaId} FOR UPDATE`;
  const cobranca = await tx.cobranca.findUnique({ where: { id: cobrancaId } });
  if (!cobranca) throw new ErroRegra("Cobrança não encontrada.");
  if (cobranca.status === StatusCobranca.PAGO) throw new ErroRegra("Cobrança já está paga.");
  if (cobranca.status === StatusCobranca.CANCELADA)
    throw new ErroRegra("Cobrança cancelada não recebe pagamento.");

  // ACUMULA baixas parciais (issues #1/#10): nunca sobrescreve o total já recebido; saldo/
  // quitação pelo ACUMULADO; excedente acima do negociado só passa como crédito explícito.
  const jaRecebido = numeroOuNull(cobranca.valorRecebido) ?? 0;
  const { recebidoTotal, saldo, quitada, excedente } = acumularPagamento(
    jaRecebido,
    numero(cobranca.valorNegociado),
    dados.valorRecebido,
    dados.permitirExcedente ?? false,
  );

  await tx.cobranca.update({
    where: { id: cobrancaId },
    data: {
      valorRecebido: recebidoTotal,
      saldo,
      status: quitada ? StatusCobranca.PAGO : StatusCobranca.PENDENTE,
      pagoEm: quitada ? dados.dataPagamento ?? new Date() : null,
      formaPagamento: dados.forma,
      comprovanteUrl: dados.comprovanteUrl ?? null,
      comprovanteNome: dados.comprovanteNome ?? null,
      comentario: dados.comentario || null,
    },
  });
  await registrarEvento(tx, {
    tipo: "PagamentoRegistrado",
    agregadoTipo: "Cobranca",
    agregadoId: cobrancaId,
    autorId,
    payload: {
      valorRecebido: dados.valorRecebido,
      recebidoAcumulado: recebidoTotal,
      forma: dados.forma,
      quitada,
      saldo,
      excedente,
      via: dados.via,
      comprovanteUrl: dados.comprovanteUrl ?? null,
      comprovanteNome: dados.comprovanteNome ?? null,
    },
  });

  // C4 (doc 27): taxa de matrícula QUITADA é gatilho da matrícula automática.
  let matriculaAtivada = false;
  if (quitada && cobranca.tipo === TipoCobranca.MATRICULA) {
    const auto = await ativarSeFechamentoCompletoTx(tx, cobranca.matriculaId, autorId);
    matriculaAtivada = auto.ativou;
  }

  return { quitada, recebidoTotal, saldo, matriculaAtivada };
}
