import { prisma } from "@/lib/prisma";

// Consultas (leitura) do Catálogo — chamadas por Server Components.

export async function listarIdiomas() {
  return prisma.idioma.findMany({
    orderBy: { nome: "asc" },
    include: {
      niveis: { orderBy: { ordem: "asc" } },
      _count: { select: { produtos: true } },
    },
  });
}

export async function listarModalidades() {
  return prisma.modalidade.findMany({
    orderBy: { nome: "asc" },
    include: { _count: { select: { produtos: true, turmas: true } } },
  });
}

export async function listarProdutos() {
  return prisma.produto.findMany({
    orderBy: [{ idioma: { nome: "asc" } }, { modalidade: { nome: "asc" } }],
    include: {
      idioma: true,
      modalidade: true,
      _count: { select: { precos: true, produtosPais: true } },
    },
  });
}

export async function listarPrecos() {
  return prisma.precoReferencia.findMany({
    orderBy: [{ ativo: "desc" }, { criadoEm: "desc" }],
    include: {
      pais: true,
      modalidade: true,
      produto: { include: { idioma: true, modalidade: true } },
    },
  });
}

export type IdiomaListado = Awaited<ReturnType<typeof listarIdiomas>>[number];
export type ModalidadeListada = Awaited<ReturnType<typeof listarModalidades>>[number];
export type ProdutoListado = Awaited<ReturnType<typeof listarProdutos>>[number];
export type PrecoListado = Awaited<ReturnType<typeof listarPrecos>>[number];
