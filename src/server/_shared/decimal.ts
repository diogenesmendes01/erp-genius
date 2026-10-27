import { Prisma } from "@prisma/client";

export function numero(v: Prisma.Decimal | number): number {
  return typeof v === "number" ? v : v.toNumber();
}

export function numeroOuNull(v: Prisma.Decimal | number | null | undefined): number | null {
  return v == null ? null : numero(v);
}

export type SemDecimais<T> = T extends Prisma.Decimal
  ? number
  : T extends Date
    ? T
    : T extends Array<infer U>
      ? SemDecimais<U>[]
      : T extends object
        ? { [K in keyof T]: SemDecimais<T[K]> }
        : T;

export function semDecimais<T>(x: T): SemDecimais<T> {
  if (x == null || typeof x !== "object") return x as SemDecimais<T>;
  if (Prisma.Decimal.isDecimal(x)) return (x as unknown as Prisma.Decimal).toNumber() as SemDecimais<T>;
  if (x instanceof Date) return x as SemDecimais<T>;
  if (Array.isArray(x)) return x.map((i) => semDecimais(i)) as SemDecimais<T>;
  const saida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(x)) saida[k] = semDecimais(v);
  return saida as SemDecimais<T>;
}
