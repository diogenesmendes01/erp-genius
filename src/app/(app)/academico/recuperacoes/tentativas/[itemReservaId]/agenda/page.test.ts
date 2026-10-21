import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn(), fuso: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/recuperacao-agenda-proposta", () => ({ consultarPropostasAgendaRecuperacao: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/operacao/consultas", () => ({ consultarFusoInstitucional: mocks.fuso }));
vi.mock("../../../../avaliacoes/Identificacao", () => ({ IdentificacaoAvaliacao: () => "Identificação" }));
vi.mock("./Formulario", () => ({ ProporAgenda: () => "Propor", DecidirAgenda: () => "Decidir" }));
import Page from "./page";

const dado = {
  habilidade: "FALA", agendaPublicada: false, versaoEsperada: 1, proximaAntesVersao: null, identificacao: {},
  propostas: [{
    id: "agenda", versao: 1, versaoAtual: true, autor: "Gestora", fuso: "America/Sao_Paulo",
    inicio: "2026-01-01T02:30:00.000Z", fim: "2026-01-01T03:30:00.000Z", motivo: "Horário conferido.",
    conferenciaOriginal: { professor: null, pendencias: [] }, decisao: null, encontro: null,
    revisaoIndependente: true, estadoMudou: false, impedimentoAtual: null, estadoConferido: null,
  }],
};

describe("propostas de horário da recuperação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessao.mockResolvedValue({});
    mocks.consultar.mockResolvedValue({ ok: true, dado });
    mocks.fuso.mockResolvedValue(null);
  });

  it("exibe agenda no fuso pessoal e mantém a origem publicada", async () => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ itemReservaId: "item" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("31/12/2025, 20:30");
    expect(html).toContain("America/Costa_Rica; origem America/Sao_Paulo");
  });

  it("recorre ao fuso da agenda se não houver preferência", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ itemReservaId: "item" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("31/12/2025, 23:30");
    expect(html).toContain("America/Sao_Paulo; origem America/Sao_Paulo");
  });

  it("não consulta proposta ou preferência antes da guarda", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(Page({ params: Promise.resolve({ itemReservaId: "item" }), searchParams: Promise.resolve({}) })).rejects.toThrow("Sem sessão");
    expect(mocks.consultar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});