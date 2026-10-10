import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), listar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/diario/regularizacao-consultas", () => ({ listarRegularizacoesAula: mocks.listar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./GerirDesignacoes", () => ({ GerirDesignacoes: () => null }));

import Page from "./page";

const item = { id: "e/1", status: "PREVISTO", podeGerir: false, inicio: "2026-09-01T12:00:00.000Z", fim: "2026-09-01T13:00:00.000Z", fusoOrigem: "UTC", turma: "T-1", professor: "Ana", podeRegularizar: true, designacao: null };
const dado = (sobrescrever: Record<string, unknown> = {}) => ({ ok: true, dado: { gestao: true, modo: "PENDENTES", itens: [item], temAnterior: false, temProxima: true, anterior: null, proxima: "e30", ...sobrescrever } });
const render = async (params: Record<string, string>) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));

describe("/diario/regularizacoes — fila por cursor nos dois sentidos (E4)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
  });

  it("início: só Próxima, mantendo o modo e sem link para si mesmo", async () => {
    mocks.listar.mockResolvedValue(dado());
    const html = await render({});
    expect(mocks.listar).toHaveBeenCalledWith({ modo: "PENDENTES" });
    expect(html).not.toContain("Anterior");
    expect(html).not.toContain("pagina");
    expect(html).toContain('href="/diario/regularizacoes?modo=PENDENTES&amp;depois=e30">Próxima');
  });

  it("no meio do histórico: os dois sentidos, cada um com o cursor certo e no mesmo modo", async () => {
    mocks.listar.mockResolvedValue(dado({ modo: "HISTORICO", temAnterior: true, anterior: "e31", proxima: "e60" }));
    const html = await render({ modo: "HISTORICO", depois: "e30" });
    expect(mocks.listar).toHaveBeenCalledWith({ depois: "e30", modo: "HISTORICO" });
    expect(html).toContain('href="/diario/regularizacoes?modo=HISTORICO&amp;antes=e31">← Anterior');
    expect(html).toContain('href="/diario/regularizacoes?modo=HISTORICO&amp;depois=e60">Próxima');
  });

  it("voltando, o cursor chega à consulta; a última não tem Próxima", async () => {
    mocks.listar.mockResolvedValue(dado({ temAnterior: true, temProxima: false, anterior: "e61", proxima: null }));
    const html = await render({ antes: "e90" });
    expect(mocks.listar).toHaveBeenCalledWith({ antes: "e90", modo: "PENDENTES" });
    expect(html).toContain('href="/diario/regularizacoes?modo=PENDENTES&amp;antes=e61">← Anterior');
    expect(html).not.toContain("Próxima");
  });

  it("vazio: no início, sem link para si; num ponto da fila sem aulas, a volta ao início no mesmo modo", async () => {
    mocks.listar.mockResolvedValue(dado({ itens: [], temProxima: false, proxima: null }));
    const inicio = await render({});
    expect(inicio).toContain("Nenhuma regularização pendente.");
    expect(inicio).not.toContain("Ir para o início da fila");
    const alem = await render({ modo: "HISTORICO", depois: "e-sumida" });
    expect(alem).toContain("Nenhuma aula a partir deste ponto da fila");
    expect(alem).toContain('href="/diario/regularizacoes?modo=HISTORICO">Ir para o início da fila');
    expect(alem).not.toContain("nesta página");
  });
});
