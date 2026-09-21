import type { FormaPagamento, Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { receberTx, bloquearMatriculas, bloquearCobranca } from "./recebimentos";
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


/** Compatibilidade da main: toda baixa continua passando pelo ledger contratual. */
export async function baixarCobrancaTx(tx: Prisma.TransactionClient, autorId: string | null, cobrancaId: string, dados: DadosBaixa): Promise<ResultadoBaixa> {
  if (!autorId) throw new ErroRegra("Conciliação automática pendente de adaptação ao recebimento contratual. Financeiro deve conferir e registrar o recebimento.");
  const referencia = await tx.cobranca.findUnique({ where: { id: cobrancaId }, select: { matriculaId: true } });
  if (!referencia) throw new ErroRegra("Cobrança não encontrada.");
  await bloquearMatriculas(tx, [referencia.matriculaId]);
  const cobranca = await bloquearCobranca(tx, cobrancaId);
  if (cobranca.faturaB2BId) {
    const fatura = await tx.faturaB2B.findUnique({ where: { id: cobranca.faturaB2BId } });
    if (fatura?.status === "FECHADA" && dados.via !== "fatura_b2b") throw new ErroRegra("Receba a cobrança pela fatura fechada ou cancele a fatura antes.");
  }
  // A fatura tem liquidação única; novas chamadas reutilizam a identidade da cobrança.
  if (dados.via !== "fatura_b2b") throw new ErroRegra("Use o fluxo de recebimentos com chave de idempotência e destinação explícita.");
  await receberTx(tx, { cobrancaId, autorId, chaveIdempotencia: "fatura:" + cobranca.faturaB2BId + ":" + cobrancaId,
    valorRecebido: dados.valorRecebido, forma: dados.forma, dataPagamento: dados.dataPagamento ?? new Date(),
    comprovanteUrl: dados.comprovanteUrl, comprovanteNome: dados.comprovanteNome,
    comentario: dados.comentario, evidencia: "Liquidação conferida da fatura " + cobranca.faturaB2BId, permitirExcedente: false });
  const atual = await tx.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
  return { quitada: atual.status === "PAGO", recebidoTotal: Number(atual.valorRecebido ?? 0), saldo: Number(atual.saldo ?? 0), matriculaAtivada: false };
}
