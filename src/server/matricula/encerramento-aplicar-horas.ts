import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import type { carregarAcertoAprovadoParaEfetivacaoTx } from "./encerramento-efetivacao-estado";

/** Integra a transação de efetivação. Valor zero também liquida os minutos restantes. */
export async function aplicarLiquidacaoHorasAcertoTx(tx: Prisma.TransactionClient, acerto: Awaited<ReturnType<typeof carregarAcertoAprovadoParaEfetivacaoTx>>) {
  const ids: string[] = [];
  for (const contrato of acerto.previa.contratos) {
    const plano = contrato.lancamentos.plano;
    if (!plano) throw new ErroRegra("Plano de lançamentos ausente.");
    for (const item of plano.horasALiquidar) {
      const r = await tx.liquidacaoHorasAcerto.create({ data: { ...item, decisaoId: acerto.decisaoId } });
      ids.push(r.id);
    }
  }
  return ids;
}
