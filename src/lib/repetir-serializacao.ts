import { Prisma } from "@prisma/client";

export function ehFalhaDeSerializacao(erro: unknown): boolean {
  if (!(erro instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return erro.code === "P2034" || (erro.code === "P2010" && (erro.meta as { code?: unknown } | undefined)?.code === "40001");
}

export async function repetirEmFalhaDeSerializacao<T>(operacao: () => Promise<T>, tentativas = 3): Promise<T> {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await operacao();
    } catch (erro) {
      if (tentativa >= tentativas || !ehFalhaDeSerializacao(erro)) throw erro;
    }
  }
}
