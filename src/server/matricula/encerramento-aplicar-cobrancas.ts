import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import type { carregarAcertoAprovadoParaEfetivacaoTx } from "./encerramento-efetivacao-estado";

/** Etapa interna: mesma transação da guarda e dos demais efeitos do encerramento. */
export async function aplicarAjustesCobrancaAcertoTx(tx: Prisma.TransactionClient, acerto: Awaited<ReturnType<typeof carregarAcertoAprovadoParaEfetivacaoTx>>, executorId: string) {
  const ajustes = [];
  for (const contrato of acerto.previa.contratos) {
    if (!contrato.lancamentos.plano) throw new ErroRegra("Plano de lançamentos ausente.");
    for (const p of contrato.lancamentos.plano.ajustes) {
      const c = await tx.cobranca.findUniqueOrThrow({ where: { id: p.cobrancaId } });
      if (c.matriculaId !== contrato.calculo.matriculaId || c.versao !== p.versaoOrigem) throw new ErroRegra("Cobrança alterada durante a aplicação.");
      const a = await tx.ajusteCobrancaAcerto.create({ data: { decisaoId: acerto.decisaoId, cobrancaId: c.id, executorId,
        versaoAnterior: c.versao, valorAnterior: c.valorNegociado, valorNovo: p.valorDevido, creditoApurado: p.credito, moeda: c.moeda,
        origem: JSON.parse(JSON.stringify(c)) as Prisma.InputJsonValue } });
      ajustes.push(a.id);
    }
  }
  return ajustes;
}
