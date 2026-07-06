import { Prisma } from "@prisma/client";

// Dinheiro no banco é DECIMAL (migration `dinheiro_decimal`, pendência P19 do doc 15):
// o Postgres é a fonte de verdade EXATA. No domínio TS seguimos com `number` — o Prisma
// devolve `Prisma.Decimal`, que NÃO serializa para Client Components e quebra aritmética
// por coerção de string (Decimal + number concatena; Decimal < Decimal compara texto).
// Regra: converta na BORDA DE LEITURA, o mais perto possível do Prisma. Escritas aceitam
// `number` direto (o client converte). Exibição/arredondamento ficam em `lib/dinheiro`.

/** Decimal (ou number) → number. Use ao ler um campo monetário NOT NULL do Prisma. */
export function numero(v: Prisma.Decimal | number): number {
  return typeof v === "number" ? v : v.toNumber();
}

/** Variante para campos monetários opcionais (null/undefined → null). */
export function numeroOuNull(v: Prisma.Decimal | number | null | undefined): number | null {
  return v == null ? null : numero(v);
}

/** Tipo espelho de `semDecimais`: troca todo Prisma.Decimal por number, fundo a fundo. */
export type SemDecimais<T> = T extends Prisma.Decimal
  ? number
  : T extends Date
    ? T
    : T extends Array<infer U>
      ? SemDecimais<U>[]
      : T extends object
        ? { [K in keyof T]: SemDecimais<T[K]> }
        : T;

/**
 * Converte recursivamente todo `Prisma.Decimal` em `number`, preservando Date e o resto
 * da estrutura. Para retornos "crus" do Prisma que atravessam a borda Server → Client
 * (ex.: ficha financeira devolve aluno + cobranças aninhadas). Em DTOs montados à mão,
 * prefira `numero`/`numeroOuNull` campo a campo — mais legível e barato.
 */
export function semDecimais<T>(x: T): SemDecimais<T> {
  if (x == null || typeof x !== "object") return x as SemDecimais<T>;
  if (Prisma.Decimal.isDecimal(x)) return (x as unknown as Prisma.Decimal).toNumber() as SemDecimais<T>;
  if (x instanceof Date) return x as SemDecimais<T>;
  if (Array.isArray(x)) return x.map((i) => semDecimais(i)) as SemDecimais<T>;
  const saida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(x)) saida[k] = semDecimais(v);
  return saida as SemDecimais<T>;
}
