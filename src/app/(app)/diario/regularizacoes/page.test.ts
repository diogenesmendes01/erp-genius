import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), listar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/diario/regularizacao-consultas", () => ({ listarRegularizacoesAula: mocks.listar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./GerirDesignacoes", () => ({ GerirDesignacoes: () => null }));

import Page from "./page";

const item = { id: "e/1", status: "PREVISTO", podeGerir: false, inicio: "2026-09-01T12:00:00.000Z", fim: "2026-09-01T13:00:00.000Z", fusoOrigem: "UTC", turma: "T-1", professor: "Ana", podeRegularizar: true, designacao: null };
const dado = (sobrescrever: Record<string, unknown> = {}) => ({ ok: true, dado: { gestao: true, modo: "PENDENTES", itens: [item], pagina: 1, temProxima: true, ...sobrescrever } });
const render = async (params: Record<string, string>) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));

describe("/diario/regularizacoes — paginação nos dois sentidos (E4)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
  });

  it("primeira página: só Próxima, mantendo o modo e sem link para si mesma", async () => {
    mocks.listar.mockResolvedValue(dado());
    const html = await render({});
    expect(mocks.listar).toHaveBeenCalledWith({ pagina: 1, modo: "PENDENTES" });
    expect(html).not.toContain("Anterior");
    expect(html).not.toContain("pagina=1");
    expect(html).toContain('href="/diario/regularizacoes?modo=PENDENTES&amp;pagina=2">Próxima');
  });

  it("no meio do histórico: os dois sentidos, cada um na página certa e no mesmo modo", async () => {
    mocks.listar.mockResolvedValue(dado({ modo: "HISTORICO", pagina: 3 }));
    const html = await render({ modo: "HISTORICO", pagina: "3" });
    expect(mocks.listar).toHaveBeenCalledWith({ pagina: 3, modo: "HISTORICO" });
    expect(html).toContain('href="/diario/regularizacoes?modo=HISTORICO&amp;pagina=2">← Anterior');
    expect(html).toContain('href="/diario/regularizacoes?modo=HISTORICO&amp;pagina=4">Próxima');
  });

  it("da segunda página, Anterior volta à primeira sem ?pagina=1; a última não tem Próxima", async () => {
    mocks.listar.mockResolvedValue(dado({ pagina: 2, temProxima: false }));
    const html = await render({ pagina: "2" });
    expect(html).toContain('href="/diario/regularizacoes?modo=PENDENTES">← Anterior');
    expect(html).not.toContain("Próxima");
  });
});
