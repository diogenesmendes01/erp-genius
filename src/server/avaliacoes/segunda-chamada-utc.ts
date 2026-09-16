import { Prisma } from "@prisma/client";

/** Colunas de agenda usam `timestamp` UTC; nunca passe `Date` diretamente ao SQL bruto. */
export function instanteUtcSql(valor: Date | string) {
  const data = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(data.getTime())) throw new Error("Instante UTC inválido.");
  return Prisma.sql`${data.toISOString()}::timestamptz AT TIME ZONE 'UTC'`;
}

export function instanteUtcOuNuloSql(valor: Date | string | null) {
  return valor === null ? Prisma.sql`NULL::timestamp` : instanteUtcSql(valor);
}
