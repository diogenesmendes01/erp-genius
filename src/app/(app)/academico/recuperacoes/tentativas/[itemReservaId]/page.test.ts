import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/recuperacao-fila-docente", () => ({ consultarTentativaRecuperacaoDesignada: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("../../AgendaPublicada", () => ({ AgendaPublicada: () => "Agenda" }));

import Page from "./page";

const dado = {
  itemReservaId: "tentativa", identificacao: { aluno: "Ana", matriculaId: "matricula", matriculaCodigo: "M1", oferta: "Inglês", turma: "T1", nivel: "A1" },
  atividade: { habilidade: "FALA", estrategia: "Estratégia", avaliacaoProposta: "Avaliação" }, agenda: null,
  disponibilizadaEm: "2026-10-01T02:30:00.000Z", reservadaEm: "2026-10-01T02:30:00.000Z", prazoVigente: "2026-10-01T02:30:00.000Z",
  realizacao: null, situacaoContratual: "ATIVA", autorizacaoEspecialAte: null, podeRegistrarRealizacao: false, podeRegistrarAgora: false, professoresHistoricos: [],
};

describe("tentativa de recuperação atribuída", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.sessao.mockResolvedValue({}); mocks.consultar.mockResolvedValue({ ok: true, dado }); });

  it("mostra fatos administrativos no fuso preferido", async () => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ itemReservaId: "tentativa" }) }));
    expect(html).toMatch(/30\/09\/2026.*20:30/);
    expect(html).toContain("America/Costa_Rica; origem UTC");
  });

  it("recorre ao UTC de origem sem preferência válida", async () => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "invalido" } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ itemReservaId: "tentativa" }) }));
    expect(html).toMatch(/01\/10\/2026.*02:30/);
    expect(html).toContain("UTC; origem UTC");
  });

  it("não consulta tentativa ou preferência antes da sessão", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(Page({ params: Promise.resolve({ itemReservaId: "tentativa" }) })).rejects.toThrow("Sem sessão");
    expect(mocks.consultar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
