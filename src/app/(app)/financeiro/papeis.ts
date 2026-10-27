import { Papel } from "@prisma/client";

export const PAPEIS_FINANCEIRO: Papel[] = [Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL];

export function abreFinanceiro(papeis: readonly Papel[]): boolean {
  return papeis.includes(Papel.ADMINISTRADOR) || papeis.some((p) => PAPEIS_FINANCEIRO.includes(p));
}
