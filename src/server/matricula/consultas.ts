import { StatusTurma, TipoCobranca } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Dados para pré-preencher a tela de Nova matrícula.

export async function obterLeadParaMatricula(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      telefoneE164: true,
      paisId: true,
      segmento: true,
      vendedorDonoId: true,
      matricula: { select: { id: true } },
    },
  });
}

/** Produtos do catálogo (idioma × modalidade) para seleção. */
export async function listarProdutosParaMatricula() {
  return prisma.produto.findMany({
    orderBy: [{ idioma: { nome: "asc" } }, { modalidade: { nome: "asc" } }],
    include: { idioma: true, modalidade: true },
  });
}

/** Turmas Abertas (com vaga calculada na UI). */
export async function listarTurmasAbertas() {
  return prisma.turma.findMany({
    where: { status: StatusTurma.ABERTA },
    orderBy: { criadoEm: "desc" },
    include: {
      modalidade: true,
      nivel: { include: { idioma: true } },
      // Conta SOMENTE alocações ativas (issue #1) — vaga calculada na UI.
      _count: { select: { alocacoes: { where: { ativa: true } } } },
    },
  });
}

/** Preços ativos (para sugerir referência → negociado). */
export async function listarPrecosAtivos() {
  return prisma.precoReferencia.findMany({
    where: { ativo: true },
    select: { paisId: true, produtoId: true, tipoCobranca: true, valor: true, moeda: true },
  });
}

export type { TipoCobranca };
