import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function listarTurmas() {
  return prisma.turma.findMany({
    orderBy: { criadoEm: "desc" },
    include: {
      regraAvaliacao: { select: { id: true, versao: true } },
      modalidade: true,
      nivel: { include: { idioma: true } },
      professor: { select: { id: true, nome: true } },
      _count: { select: { alocacoes: { where: { ativa: true } }, reservasMatricula: { where: { status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } } } } },
    },
  });
}

export async function listarNiveis() {
  return prisma.nivel.findMany({
    orderBy: [{ idioma: { nome: "asc" } }, { ordem: "asc" }],
    include: { idioma: true },
  });
}

export async function listarProfessores() {
  return prisma.usuario.findMany({
    where: { papeis: { has: Papel.PROFESSOR }, ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });
}

export type TurmaListada = Awaited<ReturnType<typeof listarTurmas>>[number];
