import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared/sessao";

export async function comUnicidade<T>(mensagem: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ErroRegra(mensagem);
    throw e;
  }
}
