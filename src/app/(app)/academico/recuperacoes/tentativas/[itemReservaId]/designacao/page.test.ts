import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/recuperacao-designacao-consulta", () => ({ consultarDesignacaoRecuperacao: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("../../../../avaliacoes/Identificacao", () => ({ IdentificacaoAvaliacao: () => "Identificação" }));
vi.mock("./Formulario", () => ({ Designar: () => "Designar" }));
vi.mock("./PreviaSubstituicao", () => ({ PreviaSubstituicao: ({ preferenciaFusoExibicao }: { preferenciaFusoExibicao: string | null }) => `Prévia ${preferenciaFusoExibicao}` }));
import Page from "./page";

const dado = {
  propostaId: "plano", itemReservaId: "item", habilidade: "FALA", identificacao: {}, atual: null, realizadaPor: null,
  agendaPublicada: true, podeAlterar: false, podeConferirSubstituicao: true, buscaProfessor: "", refinarBusca: false,
  versaoEsperada: 2, avaliadorAgendaId: "atual", professores: [], proximaAntesVersao: null,
  historico: [{ id: "historico", versao: 1, professor: { nome: "Professora" }, gestor: { nome: "Gestora" }, motivo: "Designação original", criadaEm: "2026-01-01T02:30:00.000Z" }],
};

describe("designação de recuperação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessao.mockResolvedValue({});
    mocks.consultar.mockResolvedValue({ ok: true, dado });
  });

  it("mostra histórico administrativo no fuso pessoal e entrega a preferência à prévia", async () => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ itemReservaId: "item" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("31/12/2025, 20:30");
    expect(html).toContain("America/Costa_Rica; origem UTC");
    expect(html).toContain("Prévia America/Costa_Rica");
  });

  it("recorre a UTC para o registro administrativo", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ itemReservaId: "item" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("01/01/2026, 02:30");
    expect(html).toContain("UTC; origem UTC");
  });
});