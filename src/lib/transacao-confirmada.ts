import type { Prisma, PrismaClient } from "@prisma/client";

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

const protegido = Symbol.for("erp.transacoes-confirmadas");

/** Preserva as opções e os overloads públicos do Prisma. Instala uma só vez,
 * inclusive quando o cliente global é reutilizado pelo reload do Next. */
export function protegerTransacoes(cliente: PrismaClient): PrismaClient {
  const marcado = cliente as PrismaClient & { [protegido]?: boolean };
  if (marcado[protegido]) return cliente;
  const original = cliente.$transaction.bind(cliente);
  cliente.$transaction = ((operacao: unknown, opcoes: unknown) => {
    if (typeof operacao === "function") {
      return original(confirmarTransacao(operacao as (tx: Prisma.TransactionClient) => Promise<unknown>), opcoes as Parameters<typeof original>[1]);
    }
    // A forma em lote também precisa conferir as restrições antes do COMMIT.
    const lote = operacao as Prisma.PrismaPromise<unknown>[];
    return original([...lote, cliente.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`], opcoes as { isolationLevel?: Prisma.TransactionIsolationLevel })
      .then((resultados) => resultados.slice(0, -1));
  }) as PrismaClient["$transaction"];
  Object.defineProperty(cliente, protegido, { value: true });
  return cliente;
}
