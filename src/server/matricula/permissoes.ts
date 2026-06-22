import { Papel } from "@prisma/client";

// Regras de permissão do fluxo de matrícula (issue #8).
// Centralizadas aqui para que servidor (acoes.ts) e cliente (UI) compartilhem
// exatamente os mesmos conjuntos de papéis — sem duplicação nem divergência.
//
// - criarMatricula  → VENDEDOR / GERENTE_COMERCIAL
// - ativarMatricula → FINANCEIRO / SECRETARIA_ACADEMICA
// - criar + ativar (fluxo atômico) → exige AMBOS os conjuntos.
export const PAPEIS_CRIAR: Papel[] = [Papel.VENDEDOR, Papel.GERENTE_COMERCIAL];
export const PAPEIS_ATIVAR: Papel[] = [Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA];

/**
 * O conjunto de papéis informado contém algum dos papéis exigidos?
 * Administrador passa em qualquer verificação (mesma regra do `temPapel`).
 *
 * Recebe um array de papéis (e não a sessão inteira) para poder ser usado tanto
 * no servidor quanto no client component sem importar o helper de sessão.
 */
function contemPapel(papeis: readonly Papel[], alvo: readonly Papel[]): boolean {
  if (papeis.includes(Papel.ADMINISTRADOR)) return true;
  return papeis.some((p) => alvo.includes(p));
}

export function podeCriarMatricula(papeis: readonly Papel[]): boolean {
  return contemPapel(papeis, PAPEIS_CRIAR);
}

export function podeAtivarMatricula(papeis: readonly Papel[]): boolean {
  return contemPapel(papeis, PAPEIS_ATIVAR);
}

/**
 * O fluxo atômico "Receber pagamento e ativar" exige os DOIS conjuntos de
 * papéis (criar E ativar). O botão correspondente só deve aparecer para quem
 * passa nas duas checagens; o backend continua exigindo ambos (defesa em
 * profundidade).
 */
export function podeCriarEAtivarMatricula(papeis: readonly Papel[]): boolean {
  return podeCriarMatricula(papeis) && podeAtivarMatricula(papeis);
}
