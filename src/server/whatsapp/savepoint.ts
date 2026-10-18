import type { Prisma } from "@prisma/client";

/**
 * Roda `passo` dentro de um SAVEPOINT da transação interativa. Se ele falhar (inclusive erro de banco,
 * que deixaria a transação do Postgres abortada), volta ao savepoint e devolve `aoFalhar(erro)`: a
 * transação segue utilizável. O nome é fixo por chamador (identificador SQL, sem entrada externa).
 */
export async function comSavepoint<T>(
  tx: Prisma.TransactionClient,
  nome: "abrir_setor" | "atribuir_setor",
  passo: () => Promise<T>,
  aoFalhar: (erro: unknown) => T,
): Promise<T> {
  await tx.$executeRawUnsafe(`SAVEPOINT ${nome}`);
  try {
    const r = await passo();
    await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${nome}`);
    return r;
  } catch (e) {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${nome}`);
    return aoFalhar(e);
  }
}
