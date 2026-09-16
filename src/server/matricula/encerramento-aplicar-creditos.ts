import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import type { carregarAcertoAprovadoParaEfetivacaoTx } from "./encerramento-efetivacao-estado";

/** Etapa interna. Não abre transação nem oferece emissão isolada ao usuário. */
export async function aplicarCreditosAcertoTx(tx: Prisma.TransactionClient, acerto: Awaited<ReturnType<typeof carregarAcertoAprovadoParaEfetivacaoTx>>) {
  const emitidos = [];
  for (const contrato of acerto.previa.contratos) {
    const plano = contrato.lancamentos.plano;
    if (!plano) throw new ErroRegra("Plano de lançamentos ausente.");
    for (const p of plano.creditos) {
      // Créditos de cobranças só podem acompanhar o ajuste efetivamente aplicado.
      if (p.origemTipo === "COBRANCA") {
        const ajuste = await tx.ajusteCobrancaAcerto.findUnique({ where: { cobrancaId: p.origemId } });
        if (!ajuste || ajuste.decisaoId !== acerto.decisaoId || !ajuste.creditoApurado.equals(p.valor)) throw new ErroRegra("Aplique o ajuste da mesma decisão antes de emitir seu crédito.");
      }
      const origem = await tx.origemCreditoAcerto.create({ data: { decisaoId: acerto.decisaoId, matriculaId: plano.matriculaId,
        origemTipo: p.origemTipo, origemId: p.origemId, valor: p.valor, moeda: plano.moeda } });
      const credito = await tx.creditoMatricula.create({ data: { matriculaId: plano.matriculaId, origemAcertoId: origem.id, valorInicial: p.valor, moeda: plano.moeda } });
      emitidos.push({ id: credito.id, origemId: origem.id, matriculaId: plano.matriculaId, valor: credito.valorInicial.toFixed(2), moeda: credito.moeda });
    }
  }
  return emitidos;
}
