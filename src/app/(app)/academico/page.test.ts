import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), listar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/academico/consultas", () => ({ listarSolicitacoesAcademicas: mocks.listar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./MudancasAcademicasPainel", () => ({
  MudancasAcademicasPainel: ({ fusoExibicao }: { fusoExibicao: string }) => createElement("p", { "data-testid": "painel" }, `fuso=${fusoExibicao}`),
}));

import Page from "./page";

const renderizar = (filtros: { historico?: string; pagina?: string } = {}) => Page({ searchParams: Promise.resolve(filtros) });

describe("painel acadêmico", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({ papeis: ["SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO"] });
    mocks.listar.mockResolvedValue({ ok: true, dado: { solicitacoes: [], pagina: 1, temProxima: true } });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  it("passa a preferência ao painel sem remover o link para Encontros nem a paginação", async () => {
    const html = renderToStaticMarkup(await renderizar({ historico: "todos" }));
    expect(html).toContain("fuso=America/Costa_Rica");
    expect(html).toContain('href="/diario/encontros"');
    expect(html).toContain('href="/academico?historico=todos&amp;pagina=2">Próxima');
    expect(mocks.listar).toHaveBeenCalledWith({ apenasAbertas: false, pagina: 1 });
  });

  it("paginação nos dois sentidos: primeira só com Próxima; no meio, as duas com o filtro; da segunda, Anterior sem ?pagina=1", async () => {
    const primeira = renderToStaticMarkup(await renderizar());
    expect(primeira).not.toContain("Anterior");
    expect(primeira).not.toContain("pagina=1");
    expect(primeira).toContain('href="/academico?pagina=2">Próxima');

    const meio = renderToStaticMarkup(await renderizar({ historico: "todos", pagina: "3" }));
    expect(mocks.listar).toHaveBeenLastCalledWith({ apenasAbertas: false, pagina: 3 });
    expect(meio).toContain('href="/academico?historico=todos&amp;pagina=2">← Anterior');
    expect(meio).toContain('href="/academico?historico=todos&amp;pagina=4">Próxima');

    mocks.listar.mockResolvedValue({ ok: true, dado: { solicitacoes: [], pagina: 2, temProxima: false } });
    const segunda = renderToStaticMarkup(await renderizar({ pagina: "2" }));
    expect(segunda).toContain('href="/academico">← Anterior');
    expect(segunda).not.toContain("Próxima");
  });

  it("as sub-seções da área ficam nas abas do layout (E2): a página não repete links soltos antes do título", async () => {
    const html = renderToStaticMarkup(await renderizar());
    const hrefs = [...html.matchAll(/<a[^>]*\shref="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs.filter((h) => /^\/academico\/./.test(h))).toEqual([]);
    expect(html.indexOf("<h1")).toBeLessThan(html.indexOf("<a"));
  });

  it("mantém São Paulo como fallback legado sem preferência", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await renderizar());
    expect(html).toContain("fuso=America/Sao_Paulo");
  });

  it("não consulta solicitações ou preferência antes da guarda", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(renderizar()).rejects.toThrow("Sem sessão");
    expect(mocks.listar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
