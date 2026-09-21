import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";

/** O caminho de arquivo anexado atende somente contratos sem preparação comercial.
 * Uma contratação preparada exige o aceite do original assinado pelo fluxo integrado.
 * Flags legadas e evidência sandbox não podem satisfazer essa exigência. */
export async function exigirAceiteManualPermitido(tx: Prisma.TransactionClient, matriculaId: string) {
  const preparacao = await tx.preparacaoComercialMatricula.findUnique({
    where: { matriculaId }, select: { id: true },
  });
  if (preparacao) throw new ErroRegra("Esta contratação exige conferência do original assinado pelo fluxo integrado. Um arquivo anexado ou uma confirmação legada não comprova esse aceite.");
}
