import { Prisma } from "@prisma/client";

export const escopoContratoDiario: Prisma.AlocacaoTurmaWhereInput = {
  OR: [
    { matriculaId: null, aluno: { status: "ATIVO" } },
    { matricula: { status: "ATIVA" } },
  ],
};

export const escopoAlocacoesHistoricasDiario: Prisma.AlocacaoTurmaWhereInput = {
  AND: [escopoContratoDiario, { OR: [{ ativa: true }, { encerradaEm: { not: null } }] }],
};

type VigenciaAlocacao = {
  criadoEm: Date; encerradaEm: Date | null; ativa: boolean;
  provenienciaVinculo?: string | null; inicioVigencia?: Date | null; fimVigencia?: Date | null;
};

export function alocacaoCobreAula(a: VigenciaAlocacao, instante: Date) {
  if (!Number.isFinite(instante.getTime())) return false;
  if (a.provenienciaVinculo != null && a.provenienciaVinculo !== "MIGRACAO") return false;
  const inicio = a.provenienciaVinculo === "MIGRACAO" ? a.inicioVigencia : a.criadoEm;
  if (!inicio || !Number.isFinite(inicio.getTime()) || instante < inicio) return false;
  const limites = [a.encerradaEm, ...(a.provenienciaVinculo === "MIGRACAO" ? [a.fimVigencia] : [])].filter((d): d is Date => d != null);
  if (limites.some(d => !Number.isFinite(d.getTime()) || d <= inicio)) return false;
  const fim = limites.length ? Math.min(...limites.map(d => d.getTime())) : null;
  return fim === null ? a.ativa : instante.getTime() < fim;
}

export function alunosComVinculosSobrepostos(alocacoes: readonly { alunoId: string }[]) {
  const vistos = new Set<string>(), ambiguos = new Set<string>();
  for (const a of alocacoes) {
    if (vistos.has(a.alunoId)) ambiguos.add(a.alunoId);
    vistos.add(a.alunoId);
  }
  return ambiguos;
}
