import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), listar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/diario/excecao-consulta", () => ({ listarExcecoesGravacao: mocks.listar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./DecidirExcecao", () => ({ DecidirExcecao: () => null }));

import Page from "./page";

const item = { id: "e1", encontroId: "enc", professor: "Ana", motivo: "Sem gravação por falha de rede", criadoEm: "2026-09-01T12:00:00.000Z", inicio: "2026-09-01T12:00:00.000Z", fim: "2026-09-01T13:00:00.000Z", fusoOrigem: "UTC", estadoEncontro: "PREVISTO", podeDecidir: false, diarioCorresponde: false, diarioParaRevisao: null, decisao: null };
const render = async (params: Record<string, string>) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));

describe("/diario/excecoes-gravacao — paginação nos dois sentidos (E4)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
  });

  it("primeira página: só Próxima, sem link para si mesma", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [item], pagina: 1, temProxima: true } });
    const html = await render({});
    expect(mocks.listar).toHaveBeenCalledWith({ apenasPendentes: true, pagina: 1 });
    expect(html).not.toContain("Anterior");
    expect(html).not.toContain("pagina=1");
    expect(html).toContain('href="/diario/excecoes-gravacao?pagina=2">Próxima');
  });

  it("no meio, os dois sentidos mantendo o filtro do histórico", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [item], pagina: 3, temProxima: true } });
    const html = await render({ historico: "todos", pagina: "3" });
    expect(mocks.listar).toHaveBeenCalledWith({ apenasPendentes: false, pagina: 3 });
    expect(html).toContain('href="/diario/excecoes-gravacao?historico=todos&amp;pagina=2">← Anterior');
    expect(html).toContain('href="/diario/excecoes-gravacao?historico=todos&amp;pagina=4">Próxima');
  });

  it("da segunda página, Anterior volta à primeira com o filtro e sem ?pagina=1; a última não tem Próxima", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [item], pagina: 2, temProxima: false } });
    const html = await render({ historico: "todos", pagina: "2" });
    expect(html).toContain('href="/diario/excecoes-gravacao?historico=todos">← Anterior');
    expect(html).not.toContain("Próxima");
  });
});
