import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/recuperacao-consulta", () => ({ consultarNotaRecuperacao: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));

import Page from "./page";

const dado = {
  alocacaoId: "matricula", realizacaoId: "realizacao", habilidade: "FALA", realizadaEm: "2026-10-01T02:30:00.000Z",
  identificacao: { aluno: "Ana", matriculaId: "matricula", matriculaCodigo: "M1", oferta: "Inglês", turma: "T1", nivel: "A1" },
  escala: { minimo: "0", maximo: "10" }, realizadaPor: "Prof. Ana", registradaPor: "Gestão", motivoRegularizacao: null,
  evidencia: "Registro", podeLancar: false, versaoEsperada: 1, notas: [], oficial: false, proximaAntesVersao: null,
};

describe("nota de recuperação", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.sessao.mockResolvedValue({}); mocks.consultar.mockResolvedValue({ ok: true, dado }); });

  it("exibe o instante administrativo UTC no fuso pessoal", async () => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ realizacaoId: "realizacao" }), searchParams: Promise.resolve({}) }));
    expect(html).toMatch(/30\/09\/2026.*20:30/);
    expect(html).toContain("America/Costa_Rica; origem UTC");
  });

  it("recorre ao UTC de origem sem preferência válida", async () => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "invalido" } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ realizacaoId: "realizacao" }), searchParams: Promise.resolve({}) }));
    expect(html).toMatch(/01\/10\/2026.*02:30/);
    expect(html).toContain("UTC; origem UTC");
  });

  it("bloqueia as consultas se a guarda de sessão falhar", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(Page({ params: Promise.resolve({ realizacaoId: "realizacao" }), searchParams: Promise.resolve({}) })).rejects.toThrow("Sem sessão");
    expect(mocks.consultar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
