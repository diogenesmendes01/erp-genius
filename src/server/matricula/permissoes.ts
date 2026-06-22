import { Papel } from "@prisma/client";
import { temPapel, type UsuarioSessao } from "@/server/_shared/sessao";

/**
 * Papéis que podem ATIVAR uma matrícula (receber pagamento / ativar pendente).
 * Mantido em sincronia com `PAPEIS_ATIVAR` em `acoes.ts` (ADMINISTRADOR passa
 * implicitamente via `temPapel`).
 */
export const PAPEIS_ATIVAR_MATRICULA: Papel[] = [
  Papel.FINANCEIRO,
  Papel.SECRETARIA_ACADEMICA,
];

/**
 * O usuário pode ativar matrículas? Defesa em profundidade: a UI usa isto para
 * esconder os botões de ativação; o backend (`ativarMatricula`) revalida com
 * `exigirPapel` e continua sendo a fonte da verdade.
 */
export function podeAtivarMatricula(usuario: UsuarioSessao): boolean {
  return temPapel(usuario, ...PAPEIS_ATIVAR_MATRICULA);
}
