import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";

export async function exigirAceiteManualPermitido(tx: Prisma.TransactionClient, matriculaId: string) {
  const preparacao = await tx.preparacaoComercialMatricula.findUnique({
    where: { matriculaId }, select: { id: true },
  });
  if (preparacao) throw new ErroRegra("Esta contratação exige conferência do original assinado pelo fluxo integrado. Um arquivo anexado ou uma confirmação legada não comprova esse aceite.");
}
