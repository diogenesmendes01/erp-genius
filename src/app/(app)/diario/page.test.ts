import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sessao: vi.fn(async () => ({ id: "prof", nome: "P", papeis: ["PROFESSOR"] })),
  aulas: vi.fn(async () => ({ aulas: [] as unknown[], proximo: null as string | null })),
  diario: vi.fn((props: { mensagemVazio?: string }) => createElement("section", { "data-vazio": props.mensagemVazio ?? "" })),
}));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/diario/consultas", () => ({ listarAulasDiario: mocks.aulas, listarTurmasParaDiario: async () => [] }));
vi.mock("./DiarioAulas", () => ({ DiarioAulas: mocks.diario }));

import Page from "./page";

const render = async (params: Record<string, string>) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));

describe("/diario — busca no histórico (E4)", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.aulas.mockResolvedValue({ aulas: [], proximo: null }); });

  it("formulário GET de busca; a busca e o cursor chegam à consulta", async () => {
    const html = await render({ busca: " verbos ", antes: "a1" });
    expect(mocks.aulas).toHaveBeenCalledWith(expect.anything(), "a1", "verbos");
    expect(html).toMatch(/<form method="get" action="\/diario" role="search"/);
    expect(html).toContain('value="verbos"');
    expect(html).toContain("Limpar busca");
  });

  it("paginação mantém a busca (anteriores e recentes)", async () => {
    mocks.aulas.mockResolvedValue({ aulas: [{}], proximo: "a9" });
    const html = await render({ busca: "verbos", antes: "a1" });
    expect(html).toContain('href="/diario?busca=verbos&amp;antes=a9"');
    expect(html).toContain('href="/diario?busca=verbos">Aulas recentes</a>');
    expect(html).toContain('aria-label="Páginas do histórico do diário"');
  });

  it("busca sem resultado diz o termo; sem busca, a mensagem padrão do histórico", async () => {
    expect(await render({ busca: "zé" })).toContain('data-vazio="Nenhuma aula para “zé”."');
    expect(await render({})).toContain('data-vazio=""');
  });
});
