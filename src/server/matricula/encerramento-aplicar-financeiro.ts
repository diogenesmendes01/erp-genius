import type { Prisma } from "@prisma/client";
import { carregarAcertoAprovadoParaEfetivacaoTx } from "./encerramento-efetivacao-estado";
import { aplicarAjustesCobrancaAcertoTx } from "./encerramento-aplicar-cobrancas";
import { aplicarLiquidacaoHorasAcertoTx } from "./encerramento-aplicar-horas";
import { aplicarCreditosAcertoTx } from "./encerramento-aplicar-creditos";
import { aplicarMultasAcertoTx } from "./encerramento-aplicar-multa";
import { aplicarCompensacoesAcertoTx } from "./encerramento-aplicar-compensacoes";

/** Núcleo interno: o chamador deve aplicar o encerramento acadêmico e concluir o pedido
 * nesta mesma transação. Não expor este componente como efetivação completa.
 */
export async function aplicarFinanceiroEncerramentoTx(
  tx: Prisma.TransactionClient,
  entrada: { alunoId: string; decisaoId: string; executorId: string },
  agora: Date,
) {
  const acerto = await carregarAcertoAprovadoParaEfetivacaoTx(tx, entrada, agora);
  const ajustes = await aplicarAjustesCobrancaAcertoTx(tx, acerto, entrada.executorId);
  const liquidacoesHoras = await aplicarLiquidacaoHorasAcertoTx(tx, acerto);
  const creditos = await aplicarCreditosAcertoTx(tx, acerto);
  const multas = await aplicarMultasAcertoTx(tx, acerto);
  const compensacoes = await aplicarCompensacoesAcertoTx(tx, acerto);
  // Falha de constraint diferida precisa rejeitar ainda dentro da função transacional.
  await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
  return { acerto, ajustes, liquidacoesHoras, creditos, multas, compensacoes };
}
