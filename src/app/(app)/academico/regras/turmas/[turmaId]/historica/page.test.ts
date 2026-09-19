import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), preparar: vi.fn(), historico: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/conferencia-regra-historica", () => ({ consultarPreparacaoConferenciaRegraHistorica: mocks.preparar, consultarConferenciasRegraHistorica: mocks.historico }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./ConferenciaRegraHistorica", () => ({ PrepararConferenciaRegraHistorica: () => "Seleção histórica", DecidirConferenciaRegraHistorica: () => "Decisão histórica" }));
vi.mock("../../../[nivelId]/ResumoRegra", () => ({ ResumoRegra: () => "Conteúdo congelado" }));
import Page from "./page";

const turma = { id: "turma", nome: "Turma legada", codigo: null, nivelId: "nivel", regraAvaliacaoId: null, nivel: { codigo: "A1", idioma: { nome: "Idioma" } } };
const item = {
  id: "conferencia", versao: 1, estadoHash: "a".repeat(64), motivo: "Motivo válido", evidencia: "Ata válida", criadaEm: new Date("2026-10-01T02:30:00.000Z"), preparador: { id: "u", nome: "Preparador" },
  decisao: { aprovada: true, motivo: "Decisão válida", criadaEm: new Date("2026-10-01T03:30:00.000Z"), decisor: { nome: "Decisor" } }, podeDecidir: false, podeAprovar: false,
  snapshot: { turma: { nome: "Turma legada", codigo: null, status: "EM_ANDAMENTO", dataInicio: "2026-10-01", dataFim: "2026-12-20" }, destino: { versao: 1, conteudo: {}, conteudoHash: "a" }, encontros: [], diarios: [], alocacoes: [] },
};

describe("conferência da regra histórica", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({});
    mocks.preparar.mockResolvedValue({ ok: true, dado: { turma, destinos: [{ id: "regra", versao: 1, conteudo: {}, conteudoHash: "a" }], pendencia: null } });
    mocks.historico.mockResolvedValue({ ok: true, dado: { pagina: 1, temProxima: false, itens: [item] } });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  it("converte criação e decisão, mas preserva datas civis da fotografia e seleção", async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ turmaId: "turma" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("30/09/2026, 20:30");
    expect(html).toContain("30/09/2026, 21:30");
    expect(html).toContain("America/Costa_Rica; origem UTC");
    expect(html).toContain("início 2026-10-01");
    expect(html).toContain("Seleção histórica");
    expect(html).toContain("Conteúdo congelado");
  });

  it("recorre a UTC sem preferência", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ turmaId: "turma" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("01/10/2026, 02:30");
    expect(html).toContain("UTC; origem UTC");
    expect(html).toContain("início 2026-10-01");
  });

  it("não consulta preparação, histórico ou preferência antes da guarda", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(Page({ params: Promise.resolve({ turmaId: "turma" }), searchParams: Promise.resolve({}) })).rejects.toThrow("Sem sessão");
    expect(mocks.preparar).not.toHaveBeenCalled();
    expect(mocks.historico).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});