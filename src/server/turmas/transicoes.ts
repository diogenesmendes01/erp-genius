import type { StatusTurma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared/sessao";

/**
 * Transições de status de turma permitidas (#539).
 * PLANEJADA → EM_ANDAMENTO continua permitida: o início pela agenda
 * (`src/server/agenda/inicio-turmas.ts`) e a mudança manual após o primeiro encontro usam essa aresta.
 */
export const TRANSICOES_PERMITIDAS: Readonly<Record<StatusTurma, readonly StatusTurma[]>> = {
  PLANEJADA: ["ABERTA", "EM_ANDAMENTO"],
  ABERTA: ["PLANEJADA", "EM_ANDAMENTO"],
  EM_ANDAMENTO: ["CONCLUIDA"],
  CONCLUIDA: [],
};

export function transicaoPermitida(de: StatusTurma, para: StatusTurma): boolean {
  return TRANSICOES_PERMITIDAS[de]?.includes(para) ?? false;
}

export function exigirTransicao(de: StatusTurma, para: StatusTurma): void {
  if (!transicaoPermitida(de, para)) throw new ErroRegra(`Transição de status inválida: ${de} → ${para}.`);
}
