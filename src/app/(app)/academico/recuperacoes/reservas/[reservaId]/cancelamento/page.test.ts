import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/recuperacao-agenda-cancelamento", () => ({ consultarCancelamentoAgendaRecuperacao: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("../../../../avaliacoes/Identificacao", () => ({ IdentificacaoAvaliacao: () => "Identificação" }));
vi.mock("./Formularios", () => ({ Propor: () => "Propor", Decidir: () => "Decidir" }));
import Page from "./page";

const dado = {
  identificacao: {}, estadoConferido: "a".repeat(64), podePropor: false, proximoAntesId: null,
  atual: { reservaId: "reserva", matriculaId: "matricula", cancelamentoId: null, itens: [{ id: "item", habilidade: "FALA", realizacaoId: null, inicio: "2026-01-01T02:30:00Z", fim: "2026-01-01T03:30:00Z", status: "PREVISTO", fusoOrigem: "America/Sao_Paulo" }] },
  propostas: [],
};

describe("cancelamento de agenda de recuperação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessao.mockResolvedValue({});
    mocks.consultar.mockResolvedValue({ ok: true, dado });
  });

  it("exibe o instante normalizado no fuso pessoal sem trocar a origem da agenda", async () => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "Pacific/Kiritimati" } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ reservaId: "reserva" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("01/01/2026, 16:30");
    expect(html).toContain("Pacific/Kiritimati; origem America/Sao_Paulo");
  });

  it("usa referência UTC quando o encontro histórico não fornece fuso de origem", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    mocks.consultar.mockResolvedValue({ ok: true, dado: { ...dado, atual: { ...dado.atual, itens: [{ ...dado.atual.itens[0], fusoOrigem: null }] } } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ reservaId: "reserva" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("01/01/2026, 02:30");
    expect(html).toContain("UTC; referência UTC");
  });

  it("mantém a agenda no fuso de origem quando a preferência não existe", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ reservaId: "reserva" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("31/12/2025, 23:30");
    expect(html).toContain("America/Sao_Paulo; origem America/Sao_Paulo");
  });
});