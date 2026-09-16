import type { Prisma } from "@prisma/client";

/** Confere as restrições deferred dentro do callback. No Prisma 5.22, uma
 * exceção de trigger somente no COMMIT pode não rejeitar a Promise da transação.
 * Use como callback de prisma.$transaction e mantenha efeitos externos fora dele.
 */
export function confirmarTransacao<T>(operacao: (tx: Prisma.TransactionClient) => Promise<T>) {
  return async (tx: Prisma.TransactionClient): Promise<T> => {
    const resultado = await operacao(tx);
    await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
    return resultado;
  };
}
