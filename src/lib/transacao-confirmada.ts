import type { Prisma, PrismaClient } from "@prisma/client";

export function confirmarTransacao<T>(operacao: (tx: Prisma.TransactionClient) => Promise<T>) {
  return async (tx: Prisma.TransactionClient): Promise<T> => {
    const resultado = await operacao(tx);
    await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
    return resultado;
  };
}

const protegido = Symbol.for("erp.transacoes-confirmadas");

export function protegerTransacoes(cliente: PrismaClient): PrismaClient {
  const marcado = cliente as PrismaClient & { [protegido]?: boolean };
  if (marcado[protegido]) return cliente;
  const original = cliente.$transaction.bind(cliente);
  cliente.$transaction = ((operacao: unknown, opcoes: unknown) => {
    if (typeof operacao === "function") {
      return original(confirmarTransacao(operacao as (tx: Prisma.TransactionClient) => Promise<unknown>), opcoes as Parameters<typeof original>[1]);
    }
    const lote = operacao as Prisma.PrismaPromise<unknown>[];
    return original([...lote, cliente.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`], opcoes as { isolationLevel?: Prisma.TransactionIsolationLevel })
      .then((resultados) => resultados.slice(0, -1));
  }) as PrismaClient["$transaction"];
  Object.defineProperty(cliente, protegido, { value: true });
  return cliente;
}
