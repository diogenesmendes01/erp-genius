import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import type { carregarAcertoAprovadoParaEfetivacaoTx } from "./encerramento-efetivacao-estado";

/** Etapa interna da efetivação; não emite multa isolada nem confirma recebimento. */
export async function aplicarMultasAcertoTx(tx: Prisma.TransactionClient, acerto: Awaited<ReturnType<typeof carregarAcertoAprovadoParaEfetivacaoTx>>) {
  const ids: string[] = [];
  for (const contrato of acerto.previa.contratos) {
    const p = contrato.lancamentos.plano;
    if (!p) throw new ErroRegra("Plano de lançamentos ausente.");
    const valor = new Prisma.Decimal(p.multa.valorProposto);
    if (valor.isZero()) continue;
    if (!p.multa.vencimento) throw new ErroRegra("Multa exige vencimento aprovado.");
    const c = await tx.cobranca.create({ data: {
      acertoMultaDecisaoId: acerto.decisaoId, matriculaId: p.matriculaId,
      tipo: "MULTA_ENCERRAMENTO", moeda: p.moeda, valorOriginal: p.multa.valorContratual,
      valorNegociado: valor, saldo: valor, vencimento: new Date(`${p.multa.vencimento}T00:00:00.000Z`),
    } });
    ids.push(c.id);
  }
  return ids;
}
