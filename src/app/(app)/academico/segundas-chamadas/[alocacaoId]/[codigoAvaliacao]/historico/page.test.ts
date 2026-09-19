import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/segunda-chamada-historico", () => ({ consultarHistoricoReservasSegundaChamada: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));

import Page from "./page";

const dado = {
  fusoExibicao: "America/Sao_Paulo", proximoId: "proximo &/",
  itens: [{
    id: "reserva", status: "CONSUMIDA_REALIZACAO", reservadaEm: "2026-10-01T02:30:00.000Z", reservadaPor: "Gestão",
    encontro: { inicio: "2026-10-01T03:30:00.000Z", fim: "2026-10-01T04:30:00.000Z", status: "MINISTRADO", professor: "Ana" },
    ocorrencia: { status: "PREVISTO", ocorridaEm: "2026-10-01T05:30:00.000Z", registradaPor: "Bia", criadaEm: "2026-10-01T06:30:00.000Z", motivo: "Ocorrência", evidencia: "Registro" },
    realizacao: { realizadaEm: "2026-10-01T07:30:00.000Z", professor: "Ana", registradaPor: "Bia", evidencia: "Nota" },
  }],
};

const renderizar = (antesId?: string) => Page({
  params: Promise.resolve({ alocacaoId: "alocacao", codigoAvaliacao: "A1" }), searchParams: Promise.resolve({ ...(antesId ? { antesId } : {}) }),
});

describe("histórico de reservas de segunda chamada", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({ id: "gestao" });
    mocks.consultar.mockResolvedValue({ ok: true, dado });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  it("apresenta todos os instantes na preferência e preserva a paginação", async () => {
    const html = renderToStaticMarkup(await renderizar("anterior"));
    expect(html).toContain("Instantes exibidos em America/Costa_Rica (referência institucional America/Sao_Paulo).");
    expect(html).toMatch(/30\/09\/2026.*20:30/);
    expect(html).toMatch(/30\/09\/2026.*21:30/);
    expect(html).toMatch(/30\/09\/2026.*22:30/);
    expect(html).toMatch(/30\/09\/2026.*23:30/);
    expect(html).toMatch(/01\/10\/2026.*00:30/);
    expect(html).toMatch(/01\/10\/2026.*01:30/);
    expect(html).toContain('href="/academico/segundas-chamadas/alocacao/A1/historico"');
    expect(html).toContain('href="/academico/segundas-chamadas/alocacao/A1/historico?antesId=proximo%20%26%2F"');
    expect(mocks.consultar).toHaveBeenCalledWith({ alocacaoId: "alocacao", codigoAvaliacao: "A1", antesId: "anterior" });
  });

  it("recorre à referência institucional quando não há preferência", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await renderizar());
    expect(html).toContain("Instantes exibidos em America/Sao_Paulo (referência institucional America/Sao_Paulo).");
    expect(html).toMatch(/30\/09\/2026.*23:30/);
  });

  it("não consulta histórico ou preferência quando a guarda falha", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(renderizar()).rejects.toThrow("Sem sessão");
    expect(mocks.consultar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
