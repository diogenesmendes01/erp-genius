import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { conferirCadeiaContinuidade } from "./continuidade-cadeia";

type UltimaCoberturaContinuidade = {
  id: string;
  coberturaInicio: Date;
  coberturaFim: Date;
  vencimento: Date;
};

/** Fonte transacional da âncora de continuidade; propostas sem aplicação não alteram a cadeia. */
export async function carregarUltimaCoberturaContinuidadeTx(
  tx: Prisma.TransactionClient,
  matriculaId: string,
): Promise<UltimaCoberturaContinuidade> {
  const cobrancas = await tx.cobranca.findMany({
    where: { matriculaId, tipo: "MENSALIDADE" },
    select: {
      id: true,
      status: true,
      suspensaPorItemPausaId: true,
      coberturaInicio: true,
      coberturaFim: true,
      vencimento: true,
      ajusteAcerto: { select: { id: true } },
      aplicacoesPeriodoIntegral: {
        orderBy: [{ aplicadaEm: "desc" }, { id: "desc" }],
        take: 1,
        select: { decisao: { select: { proposta: { select: { escolha: true } } } } },
      },
    },
  });

  if (cobrancas.some((cobranca) => cobranca.ajusteAcerto)) {
    throw new ErroRegra("Há mensalidade com ajuste de acerto; confira a base da continuidade antes de planejar.");
  }

  const cadeia = conferirCadeiaContinuidade({
    mensalidades: cobrancas.map((cobranca) => {
      const escolha = cobranca.aplicacoesPeriodoIntegral[0]?.decisao.proposta.escolha;
      if (escolha !== undefined && escolha !== "CREDITO" && escolha !== "COBERTURA_FUTURA") {
        throw new ErroRegra(`A regularização aplicada da mensalidade ${cobranca.id} tem escolha inválida.`);
      }
      return {
        id: cobranca.id,
        status: cobranca.status,
        suspensaPorItemPausaId: cobranca.suspensaPorItemPausaId,
        coberturaInicio: cobranca.coberturaInicio?.toISOString().slice(0, 10) ?? null,
        coberturaFim: cobranca.coberturaFim?.toISOString().slice(0, 10) ?? null,
        regularizacaoIntegral: escolha ?? null,
      };
    }),
  });
  if (cadeia.estado === "A_CONFERIR") throw new ErroRegra(cadeia.motivo);

  const ultima = cobrancas.find((cobranca) => cobranca.id === cadeia.ultima.id);
  if (!ultima || !ultima.coberturaInicio || !ultima.coberturaFim) {
    throw new ErroRegra("Não foi possível identificar a última cobertura mensal.");
  }
  return {
    id: ultima.id,
    coberturaInicio: ultima.coberturaInicio,
    coberturaFim: ultima.coberturaFim,
    vencimento: ultima.vencimento,
  };
}
