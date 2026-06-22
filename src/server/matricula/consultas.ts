import { Papel, StatusTurma, TipoCobranca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared";

// Dados para pré-preencher a tela de Nova matrícula.

export async function obterLeadParaMatricula(id: string, usuario?: UsuarioSessao) {
  const lead = await prisma.lead.findUnique({
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
  if (!lead) return null;
  // Row-level (doc 07): vendedor só pré-preenche a partir dos próprios leads.
  if (usuario) {
    const amplo =
      usuario.papeis.includes(Papel.ADMINISTRADOR) ||
      usuario.papeis.includes(Papel.GERENTE_COMERCIAL);
    if (!amplo && lead.vendedorDonoId !== usuario.id) return null;
  }
  return lead;
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
