import { Prisma } from "@prisma/client";

/** Conferência aritmética; não confirma comprovantes nem cria recebimento. */
export function recebimentoPreservavel(c: { status: string; valorNegociado: Prisma.Decimal; valorRecebido: Prisma.Decimal | null; saldo: Prisma.Decimal | null; valorLiquidadoCredito?: Prisma.Decimal; valorCompensadoPermuta?: Prisma.Decimal }) {
  const permuta = c.valorCompensadoPermuta ?? new Prisma.Decimal(0);
  const credito = c.valorLiquidadoCredito ?? new Prisma.Decimal(0);
  if ((!c.valorRecebido && !credito.greaterThan(0) && !permuta.greaterThan(0)) || !c.saldo || c.valorRecebido?.lessThan(0) || credito.lessThan(0) || permuta.lessThan(0) || c.valorNegociado.lessThan(0)) return false;
  const restante = Prisma.Decimal.max(0, c.valorNegociado.minus(c.valorRecebido ?? 0).minus(credito).minus(permuta));
  if (!c.saldo.equals(restante)) return false;
  return c.status === "PAGO" ? restante.equals(0)
    : ["PENDENTE", "ATRASADO", "CANCELADA"].includes(c.status) && restante.greaterThan(0);
}
