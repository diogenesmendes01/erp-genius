import { Prisma } from "@prisma/client";

/** Contrato explícito governa o acesso; outro contrato ativo não o substitui.
 * Legado conserva sua regra até conferir o vínculo, sem inferir matrícula.
 */
export const escopoContratoDiario: Prisma.AlocacaoTurmaWhereInput = {
  OR: [
    { matriculaId: null, aluno: { status: "ATIVO" } },
    { matricula: { status: "ATIVA" } },
  ],
};

export const escopoAlocacoesHistoricasDiario: Prisma.AlocacaoTurmaWhereInput = {
  AND: [escopoContratoDiario, { OR: [{ ativa: true }, { encerradaEm: { not: null } }] }],
};

export function alocacaoCobreAula(a: { criadoEm: Date; encerradaEm: Date | null; ativa: boolean }, instante: Date) {
  return a.criadoEm <= instante && (a.encerradaEm ? instante < a.encerradaEm : a.ativa);
}

/** Duas alocações elegíveis na mesma aula exigem conferência, mesmo com o mesmo contrato. */
export function alunosComVinculosSobrepostos(alocacoes: readonly { alunoId: string }[]) {
  const vistos = new Set<string>(), ambiguos = new Set<string>();
  for (const a of alocacoes) {
    if (vistos.has(a.alunoId)) ambiguos.add(a.alunoId);
    vistos.add(a.alunoId);
  }
  return ambiguos;
}
