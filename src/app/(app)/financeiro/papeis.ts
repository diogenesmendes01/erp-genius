import { Papel } from "@prisma/client";

// Painel financeiro global (doc 07 / nav): Admin, Financeiro, Gerente Comercial — o Administrador passa
// sempre, como em todo guard. É o guard de /financeiro (contexto.ts) e a regra de quem RECEBE um link para
// /financeiro em outra tela (docs/43 §6 item 7): a Secretaria não abre o painel e não ganha o link.
export const PAPEIS_FINANCEIRO: Papel[] = [Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL];

/** O papel abre /financeiro? (mesma regra do guard: Administrador ou um dos PAPEIS_FINANCEIRO.) */
export function abreFinanceiro(papeis: readonly Papel[]): boolean {
  return papeis.includes(Papel.ADMINISTRADOR) || papeis.some((p) => PAPEIS_FINANCEIRO.includes(p));
}
