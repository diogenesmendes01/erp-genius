import { prisma } from "@/lib/prisma";

// Consultas (leitura) de País — chamadas por Server Components.
// Mutações ficam em ./acoes.ts.

/** Lista enxuta (id + nome) para selects. */
export async function listarPaisesSimples() {
  return prisma.pais.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } });
}

export async function listarPaises() {
  return prisma.pais.findMany({
    orderBy: { nome: "asc" },
    include: {
      tiposDocumento: true,
      produtosPais: { select: { produtoId: true, oferecido: true } },
      _count: { select: { produtosPais: true, precos: true, alunos: true } },
    },
  });
}

/** Produtos do catálogo (idioma × modalidade) para habilitar por país. */
export async function listarProdutosCatalogo() {
  const produtos = await prisma.produto.findMany({
    orderBy: [{ idioma: { nome: "asc" } }, { modalidade: { nome: "asc" } }],
    include: { idioma: true, modalidade: true },
  });
  return produtos.map((p) => ({ id: p.id, label: `${p.idioma.nome} · ${p.modalidade.nome}` }));
}

export async function obterPais(id: string) {
  return prisma.pais.findUnique({
    where: { id },
    include: { tiposDocumento: true },
  });
}

export type PaisListado = Awaited<ReturnType<typeof listarPaises>>[number];
