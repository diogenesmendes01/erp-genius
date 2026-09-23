import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn(), fuso: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/recuperacao-autorizacao-consulta", () => ({ consultarAutorizacoesEspeciaisRecuperacao: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/operacao/consultas", () => ({ consultarFusoInstitucional: mocks.fuso }));

import Page from "./page";

const dado = {
  itemReservaId: "tentativa", habilidade: "FALA", statusMatricula: "PAUSADA", podeAutorizar: false,
  identificacao: { aluno: "Ana", matriculaId: "matricula", matriculaCodigo: "M1", oferta: "Inglês", turma: "T1", nivel: "A1" },
  historico: [{ id: "autorizacao", autorizador: { nome: "Gestora" }, criadaEm: "2026-10-01T02:30:00.000Z", prazoAte: "2026-10-02T02:30:00.000Z", motivo: "Realização autorizada." }],
  proximoId: null,
};

describe("autorização de realização de recuperação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessao.mockResolvedValue({});
    mocks.consultar.mockResolvedValue({ ok: true, dado });
    mocks.fuso.mockResolvedValue(null);
  });

  it("converte o histórico administrativo e conserva a origem UTC", async () => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ itemReservaId: "tentativa" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("30/09/2026, 20:30");
    expect(html).toContain("America/Costa_Rica; origem UTC");
    expect(html).not.toContain('name="prazoLocal"');
  });

  it("volta para UTC se a preferência estiver indisponível", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ itemReservaId: "tentativa" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("01/10/2026, 02:30");
    expect(html).toContain("UTC; origem UTC");
  });

  it("não consulta autorização nem preferência quando a guarda falha", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(Page({ params: Promise.resolve({ itemReservaId: "tentativa" }), searchParams: Promise.resolve({}) })).rejects.toThrow("Sem sessão");
    expect(mocks.consultar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
