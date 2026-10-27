import type { Prisma } from "@prisma/client";

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

export function resumoDoErro(e: unknown): { nome: string; codigo: string | null; codigoBanco: string | null } {
  if (!(e instanceof Error)) return { nome: typeof e, codigo: null, codigoBanco: null };
  const x = e as Error & { code?: unknown; meta?: { code?: unknown } };
  return {
    nome: e.name,
    codigo: typeof x.code === "string" ? x.code : null,
    codigoBanco: typeof x.meta?.code === "string" ? x.meta.code : null,
  };
}
