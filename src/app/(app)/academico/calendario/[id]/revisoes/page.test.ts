import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), historico: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/agenda/replanejamento-historico", () => ({ consultarHistoricoReplanejamento: mocks.historico }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));

import Page from "./page";

const dado = {
  calendario: { versao: 3, fusoInstitucional: "America/Sao_Paulo" }, pagina: 1, possuiMais: false,
  registros: [{ id: "revisao", versao: 2, motivo: "Replanejamento conferido", criadoEm: "2026-10-01T02:30:00.000Z", preparador: { nome: "Ana" } }],
};

describe("histórico de replanejamento", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({});
    mocks.historico.mockResolvedValue({ ok: true, dado });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  it("exibe instante administrativo na preferência atravessando o dia e identifica a origem", async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "calendario" }), searchParams: Promise.resolve({}) }));
    expect(html).toMatch(/30\/09\/2026.*20:30/);
    expect(html).toContain("America/Costa_Rica; origem America/Sao_Paulo");
  });

  it("recorre ao fuso institucional quando a preferência não está disponível", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "calendario" }), searchParams: Promise.resolve({}) }));
    expect(html).toMatch(/30\/09\/2026.*23:30/);
    expect(html).toContain("America/Sao_Paulo; origem America/Sao_Paulo");
  });

  it("não consulta histórico ou preferência antes da guarda", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(Page({ params: Promise.resolve({ id: "calendario" }), searchParams: Promise.resolve({}) })).rejects.toThrow("Sem sessão");
    expect(mocks.historico).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
