import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), listar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({
  exigirSessaoPagina: mocks.sessao,
  temPapel: (usuario: { papeis?: string[] }, ...papeis: string[]) => papeis.some((papel) => usuario.papeis?.includes(papel)),
}));
vi.mock("@/server/academico/consultas", () => ({ listarSolicitacoesAcademicas: mocks.listar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./MudancasAcademicasPainel", () => ({
  MudancasAcademicasPainel: ({ fusoExibicao }: { fusoExibicao: string }) => createElement("p", { "data-testid": "painel" }, `fuso=${fusoExibicao}`),
}));

import Page from "./page";

const renderizar = (filtros: { historico?: string; antesDe?: string } = {}) => Page({ searchParams: Promise.resolve(filtros) });

describe("painel acadêmico", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({ papeis: ["SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO"] });
    mocks.listar.mockResolvedValue({ ok: true, dado: { solicitacoes: [], proximo: "cursor-proximo" } });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  it("passa a preferência ao painel sem remover permissões, links ou paginação", async () => {
    const html = renderToStaticMarkup(await renderizar({ historico: "todos" }));
    expect(html).toContain("fuso=America/Costa_Rica");
    expect(html).toContain('href="/academico/avaliacoes"');
    expect(html).toContain('href="/academico/segundas-chamadas/agendas"');
    expect(html).toContain('href="/academico/regras"');
    expect(html).toContain('href="/academico?historico=todos&amp;antesDe=cursor-proximo"');
    expect(mocks.listar).toHaveBeenCalledWith({ apenasAbertas: false, antesDe: undefined });
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
