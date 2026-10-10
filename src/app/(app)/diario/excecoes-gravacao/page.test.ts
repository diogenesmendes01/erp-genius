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
const navegacao = (n: Record<string, unknown> = {}) => ({ temAnterior: false, temProxima: false, anterior: null, proxima: null, ...n });

describe("/diario/excecoes-gravacao — fila por cursor nos dois sentidos (E4)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
  });

  it("início: só Próxima, sem link para si mesmo", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [item], ...navegacao({ temProxima: true, proxima: "e30" }) } });
    const html = await render({});
    expect(mocks.listar).toHaveBeenCalledWith({ apenasPendentes: true });
    expect(html).not.toContain("Anterior");
    expect(html).not.toContain("pagina");
    expect(html).toContain('href="/diario/excecoes-gravacao?depois=e30">Próxima');
  });

  it("no meio, os dois sentidos com o cursor certo, mantendo o filtro do histórico", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [item], ...navegacao({ temAnterior: true, temProxima: true, anterior: "e31", proxima: "e60" }) } });
    const html = await render({ historico: "todos", depois: "e30" });
    expect(mocks.listar).toHaveBeenCalledWith({ depois: "e30", apenasPendentes: false });
    expect(html).toContain('href="/diario/excecoes-gravacao?historico=todos&amp;antes=e31">← Anterior');
    expect(html).toContain('href="/diario/excecoes-gravacao?historico=todos&amp;depois=e60">Próxima');
  });

  it("voltando, o cursor chega à consulta com o filtro; a última não tem Próxima", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [item], ...navegacao({ temAnterior: true, anterior: "e61" }) } });
    const html = await render({ historico: "todos", antes: "e90" });
    expect(mocks.listar).toHaveBeenCalledWith({ antes: "e90", apenasPendentes: false });
    expect(html).toContain('href="/diario/excecoes-gravacao?historico=todos&amp;antes=e61">← Anterior');
    expect(html).not.toContain("Próxima");
  });

  it("vazio: no início, sem link para si; depois de um cursor que não leva a nada, a volta ao início com o filtro", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [], ...navegacao() } });
    const inicio = await render({});
    expect(inicio).toContain("Nenhuma solicitação encontrada.");
    expect(inicio).not.toContain("Ir para o início da fila");
    const alem = await render({ historico: "todos", depois: "e-sumida" });
    expect(alem).toContain("Nenhuma solicitação a partir deste ponto da fila");
    expect(alem).toContain('href="/diario/excecoes-gravacao?historico=todos">Ir para o início da fila');
    expect(alem).not.toContain("nesta página");
  });
});
