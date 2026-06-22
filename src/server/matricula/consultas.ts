import { StatusTurma, TipoCobranca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared";
import { escopoLeads } from "@/server/comercial/consultas";

// Dados para pré-preencher a tela de Nova matrícula.

/**
 * Lead para pré-preencher a tela de Nova matrícula, respeitando a visibilidade
 * row-level (doc 07): Vendedor só enxerga os próprios; Gerente Comercial/Admin
 * enxergam tudo. Fora do escopo → retorna null (a tela trata como "sem lead").
 */
export async function obterLeadParaMatricula(id: string, usuario: UsuarioSessao) {
  return prisma.lead.findFirst({
    where: { id, ...escopoLeads(usuario) },
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
      _count: { select: { alocacoes: true } },
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
