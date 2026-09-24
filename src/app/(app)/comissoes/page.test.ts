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
    expect(mocks.pagina).toHaveBeenCalledWith({ status: "PAGA", pagina: 2 });
    expect(html).toMatch(/<form method="get" action="\/comissoes"/);
    expect(html).toContain('<option value="PAGA" selected="">');
    expect(html).toContain("51–100 de 120 comissões");
    expect(html).toContain('href="/comissoes?status=PAGA&amp;pagina=3"');
    await render({ status: "INVENTADA" });
    expect(mocks.pagina).toHaveBeenLastCalledWith({ status: null, pagina: 1 });
  });

  it("página além do fim volta à última; filtro sem resultado oferece ver todas", async () => {
    mocks.pagina.mockResolvedValue({ itens: [], total: 60 });
    await expect(render({ status: "PAGA", pagina: "5" })).rejects.toThrow("REDIRECT /comissoes?status=PAGA&pagina=2");
    mocks.pagina.mockResolvedValue({ itens: [], total: 0 });
    expect(await render({ status: "ESTORNADA" })).toContain("Nenhuma comissão nesta situação.");
    expect(await render({})).toContain("Nenhuma comissão no seu escopo.");
  });
});
