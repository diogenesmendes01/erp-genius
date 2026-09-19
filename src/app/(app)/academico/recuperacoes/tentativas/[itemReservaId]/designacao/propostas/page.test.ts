import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/recuperacao-substituicao-proposta", () => ({ consultarPropostasSubstituicaoRecuperacao: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("../../../../../avaliacoes/Identificacao", () => ({ IdentificacaoAvaliacao: () => "Identificação" }));
vi.mock("./DecidirSubstituicao", () => ({ DecidirSubstituicao: () => "Decidir" }));
import Page from "./page";

const dado = {
  habilidade: "FALA", identificacao: {}, proximaAntesVersao: null,
  propostas: [{
    id: "substituicao", versao: 1, versaoAtual: true, autor: "Gestora", criadaEm: "2026-01-01T02:30:00.000Z", motivo: "Substituição necessária.",
    conferenciaOriginal: { avaliadorAtual: "Prof. A", substituto: "Prof. B", inicio: "2026-01-01T02:30:00.000Z", fim: "2026-01-01T03:30:00.000Z", prazoVigente: "2026-01-02T02:30:00.000Z", fusoOrigem: "America/Sao_Paulo", pendencias: [] },
    decisao: null, aplicada: false, avaliadorAplicado: null, revisaoIndependente: true, estadoMudou: false, impedimentoAtual: null, podeDecidir: false, podeAprovar: false, propostaHash: null,
  }],
};

describe("propostas de substituição da recuperação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessao.mockResolvedValue({});
    mocks.consultar.mockResolvedValue({ ok: true, dado });
  });

  it("separa a data administrativa UTC do horário conferido na origem da agenda", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ itemReservaId: "item" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("01/01/2026, 02:30");
    expect(html).toContain("UTC; origem UTC");
    expect(html).toContain("31/12/2025, 23:30");
    expect(html).toContain("America/Sao_Paulo; origem America/Sao_Paulo");
  });
});