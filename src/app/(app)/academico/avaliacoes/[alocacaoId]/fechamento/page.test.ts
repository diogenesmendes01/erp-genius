import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), revisar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/fechamento", () => ({ revisarFechamentoAcademico: mocks.revisar, confirmarFechamentoAcademico: vi.fn() }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./ConfirmarFechamento", () => ({ ConfirmarFechamento: () => null }));
vi.mock("./ExcecaoFrequencia", () => ({ ExcecaoFrequencia: () => null }));

import Page from "./page";

const dado = {
  estadoHash: "a".repeat(64), versaoAtual: 3,
  snapshot: {
    consolidado: { resultado: { geral: { numerador: "7", denominador: "1" }, minimoGeral: "6,00", atendeRequisitosNotas: true, habilidades: [] } },
    frequencia: { atendeMinimo: true, percentual: { numerador: "100", denominador: "1" }, minimoPercentual: 75, base: 10, presencas: 10, regularizadas: 0, faltas: 0, impedimentos: 0, pendencias: [], pendenciasHistoricas: [], excecaoFrequencia: null },
  },
  elegibilidade: { situacao: "SUFICIENTE", pendencias: [], insuficiencias: [], podeProgredir: true, podeFechar: true },
  ultimo: { versao: 3, confirmadoEm: "2026-10-01T02:30:00.000Z", resultadoSuficiente: true, atual: true },
};

describe("fechamento acadêmico", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({ id: "gestao" });
    mocks.revisar.mockResolvedValue({ ok: true, dado });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  it("converte somente o instante administrativo e preserva os cálculos", async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ alocacaoId: "alocacao" }) }));
    expect(html).toMatch(/30\/09\/2026.*20:30/);
    expect(html).toContain("America/Costa_Rica; origem UTC");
    expect(html).toContain("Resultado geral: 7,00. Mínimo geral: 6,00.");
    expect(html).toContain("Frequência real: atinge o mínimo.");
  });

  it("recorre a UTC sem preferência", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ alocacaoId: "alocacao" }) }));
    expect(html).toMatch(/01\/10\/2026.*02:30/);
    expect(html).toContain("UTC; origem UTC");
  });

  it("não lê fechamento ou preferência quando a guarda falha", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(Page({ params: Promise.resolve({ alocacaoId: "alocacao" }) })).rejects.toThrow("Sem sessão");
    expect(mocks.revisar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
