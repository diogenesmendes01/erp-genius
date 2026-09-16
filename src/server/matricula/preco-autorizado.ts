import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared/sessao";
import { ConferenciaAlcadaSchema } from "./alcada-preparacao";

/** Chamador mantém a matrícula bloqueada até concluir sua operação. */
export async function exigirPrecoPreparacaoAutorizado(tx: Prisma.TransactionClient, matriculaId: string) {
  const preparacao = await tx.preparacaoComercialMatricula.findUnique({
    where: { matriculaId }, select: { referencias: true, decisaoPreco: { select: { aprovada: true } } },
  });
  // Matrículas legadas continuam submetidas às validações do seu próprio fluxo.
  if (!preparacao) return;
  const memoria = z.object({ alcada: ConferenciaAlcadaSchema }).safeParse(preparacao.referencias);
  if (!memoria.success) throw new ErroRegra("A preparação não possui análise de preço conferível. Regularize antes de confirmar o contrato ou ativar a matrícula.");
  if (preparacao.decisaoPreco?.aprovada === false) throw new ErroRegra("A proposta de preço foi rejeitada. Regularize a contratação antes de prosseguir.");
  if (memoria.data.alcada.componentes.some((c) => c.resultado !== "DENTRO_ALCADA") && !preparacao.decisaoPreco?.aprovada) {
    throw new ErroRegra("A exceção de preço ainda precisa de aprovação independente antes de confirmar o contrato ou ativar a matrícula.");
  }
}
