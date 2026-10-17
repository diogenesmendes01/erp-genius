import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared/sessao";

/**
 * A checagem "já existe?" roda antes da transação; duas chamadas simultâneas passam por ela e a segunda
 * esbarra no índice único (P2002). Traduz essa corrida na mesma mensagem da checagem, em vez do erro genérico.
 */
export async function comUnicidade<T>(mensagem: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ErroRegra(mensagem);
    throw e;
  }
}
