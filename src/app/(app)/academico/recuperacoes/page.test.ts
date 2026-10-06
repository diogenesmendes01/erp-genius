import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), listar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/recuperacao-consulta", () => ({ listarRecuperacoesRealizadas: mocks.listar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));

import Page from "./page";

const dado = {
  identificacao: { aluno: "Ana", matriculaId: "matricula", matriculaCodigo: "M1", oferta: "Inglês", turma: "T1", nivel: "A1" },
  realizacoes: [{ id: "realizacao", habilidade: "FALA", realizadaEm: "2026-10-01T02:30:00.000Z", estado: "PENDENTE" }],
  proximoId: null,
};

describe("recuperações realizadas", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.sessao.mockResolvedValue({}); mocks.listar.mockResolvedValue({ ok: true, dado }); });

  it("exibe instante UTC no fuso pessoal, inclusive na véspera", async () => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ alocacaoId: "matricula" }) }));
    expect(html).toMatch(/30\/09\/2026.*20:30/);
    expect(html).toContain("America/Costa_Rica; origem UTC");
  });

  it("usa o fuso de origem quando a preferência não está disponível", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toMatch(/01\/10\/2026.*02:30/);
    expect(html).toContain("UTC; origem UTC");
  });

  it("exige a sessão antes das consultas", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("Sem sessão");
    expect(mocks.listar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });

  // Revisão R1 da #134 (B5): página 1 × página seguinte, com o href exato da volta.
  it("vazio: página 1 diz que não há realização; página seguinte oferece a volta preservando a alocação", async () => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
    mocks.listar.mockResolvedValue({ ok: true, dado: { ...dado, realizacoes: [] } });
    const primeira = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ alocacaoId: "aloc-1" }) }));
    expect(primeira).toContain("Nenhuma recuperação realizada neste vínculo.");
    expect(primeira).not.toContain("nesta página");
    expect(primeira).not.toContain("Ir para a primeira página");
    const seguinte = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ alocacaoId: "aloc-1", depoisId: "r9" }) }));
    expect(seguinte).toContain("Nenhuma realização disponível nesta página.");
    expect(seguinte).toContain('<a class="underline" href="/academico/recuperacoes?alocacaoId=aloc-1">Ir para a primeira página</a>');
  });
});
