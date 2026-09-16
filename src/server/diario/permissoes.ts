import { Papel, type Prisma } from "@prisma/client";
import type { UsuarioSessao } from "@/server/_shared/sessao";

export function escopoTurmasDocente(professorId: string, agora = new Date()): Prisma.TurmaWhereInput {
  return { professorId, status: { not: "CONCLUIDA" }, vinculosDocentes: { some: { professorId, inicio: { lte: agora }, fim: null } } };
}

export function ehGestaoDiario(usuario: UsuarioSessao) {
  return usuario.papeis.some((p) => p === Papel.ADMINISTRADOR || p === Papel.GERENTE_PEDAGOGICO);
}

export function vinculoCobre(vinculo: { inicio: Date; fim: Date | null }, instante: Date) {
  return vinculo.inicio <= instante && (!vinculo.fim || instante < vinculo.fim);
}

export function docenteAtual(
  professorId: string,
  turma: { professorId: string | null; status: string; vinculosDocentes: { professorId: string; inicio: Date; fim: Date | null }[] },
  agora = new Date(),
) {
  return turma.professorId === professorId && turma.status !== "CONCLUIDA" && turma.vinculosDocentes.some((v) => v.professorId === professorId && v.fim === null && vinculoCobre(v, agora));
}
