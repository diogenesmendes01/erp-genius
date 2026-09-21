import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import type { carregarAcertoAprovadoParaEfetivacaoTx } from "./encerramento-efetivacao-estado";

/** Destinação interna na mesma transação do ajuste. Não emite crédito adicional. */
export async function aplicarCompensacoesAcertoTx(tx: Prisma.TransactionClient, acerto: Awaited<ReturnType<typeof carregarAcertoAprovadoParaEfetivacaoTx>>) {
  const ids: string[] = [];
  for (const contrato of acerto.previa.contratos) {
    const p = contrato.lancamentos.plano;
    if (!p) throw new ErroRegra("Plano de lançamentos ausente.");
    for (const c of p.compensacoes) {
      const dias = [
        ...c.apuracao.diasPendentes.map(data => ({ data, tratamento: "COMPENSACAO" })),
        ...c.apuracao.origem.diasContempladosNoProporcional.map(data => ({ data, tratamento: "PROPORCIONAL" })),
      ];
      for (const dia of dias) {
        const origem = await tx.diaCompensacaoCobertura.findFirst({ where: {
          matriculaId: p.matriculaId, compensacaoId: { in: c.compensacaoIds }, diaOrigem: new Date(`${dia.data}T00:00:00Z`),
        }, select: { id: true } });
        if (!origem) throw new ErroRegra("Dia de compensação não encontrado no plano.");
        const r = await tx.destinacaoDiaAcerto.create({ data: { diaId: origem.id, decisaoId: acerto.decisaoId, tratamento: dia.tratamento } });
        ids.push(r.id);
      }
    }
  }
  return ids;
}
