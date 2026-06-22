import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Consultas (leitura) de Turmas — chamadas por Server Components.

export async function listarTurmas() {
  return prisma.turma.findMany({
    orderBy: { criadoEm: "desc" },
    include: {
      modalidade: true,
      nivel: { include: { idioma: true } },
      professor: { select: { id: true, nome: true } },
      // Ocupação conta só alocações ativas — transferência/remoção desativa (ativa:false) e mantém histórico.
      _count: { select: { alocacoes: { where: { ativa: true } } } },
    },
  });
}

/** Níveis (com idioma) para o seletor de turma. */
export async function listarNiveis() {
  return prisma.nivel.findMany({
    orderBy: [{ idioma: { nome: "asc" } }, { ordem: "asc" }],
    include: { idioma: true },
  });
}

/** Usuários com papel de Professor, para alocar à turma. */
export async function listarProfessores() {
  return prisma.usuario.findMany({
    where: { papeis: { has: Papel.PROFESSOR }, ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });
}

export type TurmaListada = Awaited<ReturnType<typeof listarTurmas>>[number];
