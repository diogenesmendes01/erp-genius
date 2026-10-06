import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sessao: vi.fn(async () => ({ id: "fin", papeis: ["FINANCEIRO"] })),
  pagina: vi.fn(async () => ({ itens: [] as unknown[], total: 0 })),
  redirect: vi.fn((d: string) => { throw new Error(`REDIRECT ${d}`); }),
}));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/financeiro/consultas", () => ({ COMISSOES_POR_PAGINA: 50, listarComissoesPagina: mocks.pagina }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import Page from "./page";

const render = async (params: Record<string, string>) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));
const comissao = (i: number) => ({ id: `c${i}`, vendedor: "Bia", valor: 10, moeda: "USD", percentual: 5, tipo: "PERCENTUAL", status: "PENDENTE", dataPrevistaPagamento: null });

describe("/comissoes — filtro e páginas (E4)", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.pagina.mockResolvedValue({ itens: [], total: 0 }); });

  it("guard antes da consulta", async () => {
    mocks.sessao.mockRejectedValueOnce(new Error("negado"));
    await expect(render({})).rejects.toThrow("negado");
    expect(mocks.pagina).not.toHaveBeenCalled();
  });

  it("situação só do enum e página chegam à consulta; filtro no formulário GET", async () => {
    mocks.pagina.mockResolvedValue({ itens: Array.from({ length: 50 }, (_, i) => comissao(i)), total: 120 });
    const html = await render({ status: "PAGA", pagina: "2" });
    expect(mocks.pagina).toHaveBeenCalledWith({ status: "PAGA", pagina: 2, ordem: { campo: "vendedor", dir: "asc" } });
    expect(html).toMatch(/<form method="get" action="\/comissoes"/);
    expect(html).toContain('<option value="PAGA" selected="">');
    expect(html).toContain("51–100 de 120 comissões");
    expect(html).toContain('href="/comissoes?status=PAGA&amp;pagina=3"');
    await render({ status: "INVENTADA" });
    expect(mocks.pagina).toHaveBeenLastCalledWith({ status: null, pagina: 1, ordem: { campo: "vendedor", dir: "asc" } });
  });

  it("ordem pelo cabeçalho (E1): a da URL chega à consulta e marca a coluna certa; links mantêm a ordem", async () => {
    mocks.pagina.mockResolvedValue({ itens: Array.from({ length: 50 }, (_, i) => comissao(i)), total: 120 });
    const html = await render({ status: "PAGA", ordem: "valor", dir: "desc", pagina: "2" });
    expect(mocks.pagina).toHaveBeenCalledWith({ status: "PAGA", pagina: 2, ordem: { campo: "valor", dir: "desc" } });
    expect(html.match(/aria-sort="/g)).toHaveLength(1);
    expect(html).toMatch(/<th scope="col" aria-sort="descending"[^>]*><a [^>]*href="\/comissoes\?status=PAGA&amp;ordem=valor&amp;dir=asc"[^>]*>Valor</);
    expect(html).toMatch(/<th scope="col"(?! aria-sort)[^>]*><a [^>]*href="\/comissoes\?status=PAGA&amp;ordem=vendedor&amp;dir=asc"[^>]*>Beneficiário</);
    expect(html).toMatch(/<th scope="col"(?! aria-sort)[^>]*><a [^>]*href="\/comissoes\?status=PAGA&amp;ordem=status&amp;dir=asc"[^>]*>Situação</);
    // Paginação, limpar filtro e o formulário GET (sem JavaScript) levam a ordem escolhida.
    expect(html).toContain('href="/comissoes?status=PAGA&amp;ordem=valor&amp;dir=desc&amp;pagina=3"');
    expect(html).toMatch(/<a[^>]*href="\/comissoes\?ordem=valor&amp;dir=desc"[^>]*>Limpar filtro<\/a>/);
    expect(html).toContain('<input type="hidden" name="ordem" value="valor"/>');
    expect(html).toContain('<input type="hidden" name="dir" value="desc"/>');
  });

  it("sem ordem na URL (ou fora da lista): beneficiário crescente marcado e URLs sem ordem", async () => {
    mocks.pagina.mockResolvedValue({ itens: Array.from({ length: 50 }, (_, i) => comissao(i)), total: 120 });
    const html = await render({ ordem: "percentual", dir: "desc" });
    expect(mocks.pagina).toHaveBeenLastCalledWith({ status: null, pagina: 1, ordem: { campo: "vendedor", dir: "asc" } });
    expect(html).toMatch(/aria-sort="ascending"[^>]*><a [^>]*href="\/comissoes\?ordem=vendedor&amp;dir=desc"[^>]*>Beneficiário</);
    expect(html).toContain('href="/comissoes?pagina=2"');
    expect(html).not.toContain('type="hidden"');
    // Valor: o 1º clique ordena do maior para o menor (R1 da #136, B6).
    expect(html).toContain('href="/comissoes?ordem=valor&amp;dir=desc"');
    expect(html).toContain('Valor<span class="sr-only">: ordenar em ordem decrescente</span>');
  });

  it("página além do fim volta à última sem perder a ordem", async () => {
    mocks.pagina.mockResolvedValue({ itens: [], total: 60 });
    await expect(render({ ordem: "status", dir: "desc", pagina: "5" })).rejects.toThrow("REDIRECT /comissoes?ordem=status&dir=desc&pagina=2");
  });

  it("página além do fim volta à última; filtro sem resultado oferece ver todas", async () => {
    mocks.pagina.mockResolvedValue({ itens: [], total: 60 });
    await expect(render({ status: "PAGA", pagina: "5" })).rejects.toThrow("REDIRECT /comissoes?status=PAGA&pagina=2");
    mocks.pagina.mockResolvedValue({ itens: [], total: 0 });
    expect(await render({ status: "ESTORNADA" })).toContain("Nenhuma comissão nesta situação.");
    expect(await render({})).toContain("Nenhuma comissão no seu escopo.");
  });
});
