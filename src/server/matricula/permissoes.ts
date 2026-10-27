import { Papel } from "@prisma/client";

export const PAPEIS_CRIAR: Papel[] = [Papel.VENDEDOR, Papel.GERENTE_COMERCIAL];
export const PAPEIS_ATIVAR: Papel[] = [Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA];

export const PAPEIS_ATIVAR_MATRICULA: Papel[] = PAPEIS_ATIVAR;

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

export function podeCriarEAtivarMatricula(papeis: readonly Papel[], capacidades: readonly string[] = []): boolean {
  const podeReceber = papeis.includes(Papel.ADMINISTRADOR) || papeis.includes(Papel.FINANCEIRO) || capacidades.includes("pagamento.caixa");
  return podeCriarMatricula(papeis) && podeAtivarMatricula(papeis) && podeReceber;
}
