import type { Prisma } from "@prisma/client";
import type { AplicacaoAdiantamentoEntrada } from "./entrada-particular-pagamentos";

/** Q172: aplicações do aditivo de adiantamento da matrícula, para a conferência da entrada.
 * `aprovada: true` repete a regra do trigger `guardar_aplicacao_adiantamento_172` (defesa em profundidade). */
export async function carregarAplicacoesAdiantamentoEntradaTx(tx: Prisma.TransactionClient, matriculaId: string): Promise<AplicacaoAdiantamentoEntrada[]> {
  const linhas = await tx.aplicacaoAdiantamentoAditivo.findMany({ where: { decisao: { aprovada: true, proposta: { matriculaId } } }, orderBy: [{ versaoCobrancaDepois: "asc" }, { id: "asc" }],
    select: { id: true, versaoCobrancaAntes: true, versaoCobrancaDepois: true, valorAnterior: true, valorNovo: true, vencimentoAnterior: true, vencimentoNovo: true, minutosAnteriores: true, minutosNovos: true,
      decisao: { select: { proposta: { select: { cobrancaId: true } } } } } });
  return linhas.map(({ decisao, ...a }) => ({ ...a, cobrancaId: decisao.proposta.cobrancaId }));
}
