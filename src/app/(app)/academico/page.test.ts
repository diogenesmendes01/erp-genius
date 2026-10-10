import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), listar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/academico/consultas", () => ({ listarFilaSolicitacoesAcademicas: mocks.listar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./MudancasAcademicasPainel", () => ({
  MudancasAcademicasPainel: ({ fusoExibicao, inicioDaFila }: { fusoExibicao: string; inicioDaFila: string | null }) => createElement("p", { "data-testid": "painel" }, `fuso=${fusoExibicao} inicio=${inicioDaFila}`),
}));

import Page from "./page";

const renderizar = (filtros: { historico?: string; depois?: string; antes?: string } = {}) => Page({ searchParams: Promise.resolve(filtros) });
const fila = (n: Record<string, unknown> = {}) => ({ ok: true, dado: { solicitacoes: [], temAnterior: false, temProxima: true, anterior: null, proxima: "s-50", ...n } });

describe("painel acadêmico", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({ papeis: ["SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO"] });
    mocks.listar.mockResolvedValue(fila());
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  it("passa a preferência ao painel sem remover o link para Encontros nem a navegação da fila", async () => {
    const html = renderToStaticMarkup(await renderizar({ historico: "todos" }));
    expect(html).toContain("fuso=America/Costa_Rica");
    expect(html).toContain('href="/diario/encontros"');
    expect(html).toContain('href="/academico?historico=todos&amp;depois=s-50">Próxima');
    expect(mocks.listar).toHaveBeenCalledWith({ historico: true });
  });

  it("fila por cursor nos dois sentidos: o início só com Próxima; no meio, as duas com o filtro e o cursor certo", async () => {
    const inicio = renderToStaticMarkup(await renderizar());
    expect(mocks.listar).toHaveBeenLastCalledWith({ historico: false });
    expect(inicio).not.toContain("Anterior");
    expect(inicio).not.toContain("pagina");
    expect(inicio).toContain('href="/academico?depois=s-50">Próxima');
    expect(inicio).toContain("inicio=null");

    mocks.listar.mockResolvedValue(fila({ temAnterior: true, anterior: "s-51", proxima: "s-100" }));
    const meio = renderToStaticMarkup(await renderizar({ historico: "todos", depois: "s-50" }));
    expect(mocks.listar).toHaveBeenLastCalledWith({ depois: "s-50", historico: true });
    expect(meio).toContain('href="/academico?historico=todos&amp;antes=s-51">← Anterior');
    expect(meio).toContain('href="/academico?historico=todos&amp;depois=s-100">Próxima');
    // Um ponto da fila sem solicitações leva de volta ao início, com o filtro.
    expect(meio).toContain("inicio=/academico?historico=todos");

    mocks.listar.mockResolvedValue(fila({ temAnterior: true, temProxima: false, anterior: "s-101", proxima: null }));
    const ultima = renderToStaticMarkup(await renderizar({ antes: "s-150" }));
    expect(mocks.listar).toHaveBeenLastCalledWith({ antes: "s-150", historico: false });
    expect(ultima).toContain('href="/academico?antes=s-101">← Anterior');
    expect(ultima).not.toContain("Próxima");
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
