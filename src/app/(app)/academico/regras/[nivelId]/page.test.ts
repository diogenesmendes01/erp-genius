import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/regras", () => ({ consultarRegrasAvaliacao: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./Formularios", () => ({ DecidirRegra: () => "Decidir regra", ProporRegra: () => "Formulário da regra" }));
vi.mock("./ResumoRegra", () => ({ ResumoRegra: () => "Parâmetros da regra" }));
import Page from "./page";

const dado = {
  nivel: { idioma: { nome: "Inglês" }, codigo: "A1" }, vigente: null, pagina: 1, temProxima: false, ultimaVersao: 1,
  regras: [{ id: "regra", versao: 1, criadaEm: new Date("2026-10-01T02:30:00.000Z"), preparador: { nome: "Gestora" }, motivo: "Regra inicial", conteudo: {}, conteudoHash: "hash", decisao: null, podeDecidir: false, podeAprovar: false }],
};

describe("regras de avaliação por nível", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({});
    mocks.consultar.mockResolvedValue({ ok: true, dado });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  it("exibe a criação administrativa na preferência e preserva o formulário da regra", async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ nivelId: "nivel" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("30/09/2026, 20:30");
    expect(html).toContain("America/Costa_Rica; origem UTC");
    expect(html).toContain("Formulário da regra");
    expect(html).toContain("Parâmetros da regra");
  });

  it("recorre a UTC sem preferência", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ nivelId: "nivel" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("01/10/2026, 02:30");
    expect(html).toContain("UTC; origem UTC");
  });

  it("não consulta a regra ou preferência antes da guarda", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(Page({ params: Promise.resolve({ nivelId: "nivel" }), searchParams: Promise.resolve({}) })).rejects.toThrow("Sem sessão");
    expect(mocks.consultar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});