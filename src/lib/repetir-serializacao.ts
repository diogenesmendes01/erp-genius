import { Prisma } from "@prisma/client";

/**
 * Em SERIALIZABLE (e REPEATABLE READ) o Postgres fixa o snapshot no início da
 * primeira instrução da transação. Quando essa instrução é o
 * `pg_advisory_xact_lock`, o snapshot é tirado ANTES da espera pelo lock: a
 * segunda transação obtém o lock depois do COMMIT da primeira, mas ainda lê o
 * estado anterior e termina com SQLSTATE 40001. O lock então não serializa
 * sozinho; a forma correta de usar SERIALIZABLE é repetir a transação inteira
 * nessa falha, e a nova tentativa enxerga o estado já confirmado (replay).
 */
export function ehFalhaDeSerializacao(erro: unknown): boolean {
  if (!(erro instanceof Prisma.PrismaClientKnownRequestError)) return false;
  // P2034: conflito de escrita/deadlock em transação interativa.
  // P2010 + 40001: o mesmo conflito surgido numa consulta crua.
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
