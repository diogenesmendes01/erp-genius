import { prisma } from "@/lib/prisma";
import { Papel } from "@prisma/client";
import { exigirSessaoComPapel } from "@/server/_shared";

const PAPEIS_CONSULTA: Papel[] = [Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.FINANCEIRO];

// Consultas (leitura) de País — chamadas por Server Components.
// Mutações ficam em ./acoes.ts.

/** Lista enxuta (id + nome) para selects. */
export async function listarPaisesSimples() {
  await exigirSessaoComPapel(...PAPEIS_CONSULTA);
  return prisma.pais.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } });
}

export async function listarPaises() {
  await exigirSessaoComPapel(Papel.ADMINISTRADOR);
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
  await exigirSessaoComPapel(Papel.ADMINISTRADOR);
  const produtos = await prisma.produto.findMany({
    orderBy: [{ idioma: { nome: "asc" } }, { modalidade: { nome: "asc" } }],
    include: { idioma: true, modalidade: true },
  });
  return produtos.map((p) => ({ id: p.id, label: `${p.idioma.nome} · ${p.modalidade.nome}` }));
}

export async function obterPais(id: string) {
  await exigirSessaoComPapel(Papel.ADMINISTRADOR);
  return prisma.pais.findUnique({
    where: { id },
    include: { tiposDocumento: true },
  });
}

export type PaisListado = Awaited<ReturnType<typeof listarPaises>>[number];

/** Opções cadastrais: sem contagens de alunos, preços internos ou ofertas por país. */
export async function listarPaisesOperacionais() {
  await exigirSessaoComPapel(...PAPEIS_CONSULTA);
  return prisma.pais.findMany({
    orderBy: { nome: "asc" },
    select: {
      id: true, nome: true, codigoISO: true, moedaLocal: true, ddi: true, fuso: true, status: true,
      tiposDocumento: { select: { id: true, nome: true, validador: true } },
    },
  });
}
