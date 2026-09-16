import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";

type JsonCanonico = null | boolean | number | string | JsonCanonico[] | { [chave: string]: JsonCanonico };

/** Ordena todas as chaves sem alterar o valor de origem; arrays preservam ordem semântica. */
export function canonizarFotografiaFinanceira(valor: unknown): JsonCanonico {
  if (valor === null || typeof valor === "boolean" || typeof valor === "string") return valor as null | boolean | string;
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) throw new TypeError("Número financeiro precisa ser finito.");
    return valor;
  }
  if (valor instanceof Date) {
    if (!Number.isFinite(valor.getTime())) throw new TypeError("Data financeira inválida.");
    return valor.toISOString();
  }
  if (Array.isArray(valor)) return valor.map(canonizarFotografiaFinanceira);
  if (valor && typeof valor === "object") {
    if (Prisma.Decimal.isDecimal(valor)) {
      if (!valor.isFinite()) throw new TypeError("Decimal financeiro precisa ser finito.");
      return valor.toString();
    }
    if (Object.getPrototypeOf(valor) !== Object.prototype && Object.getPrototypeOf(valor) !== null) throw new TypeError("Objeto não suportado na fotografia financeira.");
    const origem = valor as Record<string, unknown>;
    return Object.fromEntries(Object.keys(origem).sort().map((chave) => [chave, canonizarFotografiaFinanceira(origem[chave])])) as JsonCanonico;
  }
  throw new TypeError("Valor não serializável na fotografia financeira.");
}
export function hashFotografiaFinanceira(valor: unknown) {
  return createHash("sha256").update(JSON.stringify(canonizarFotografiaFinanceira(valor))).digest("hex");
}
