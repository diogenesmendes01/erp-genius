import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), preparar: vi.fn(), historico: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/migracao-regra", () => ({ consultarPreparacaoMigracao: mocks.preparar, consultarMigracoesRegra: mocks.historico }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("../../[nivelId]/ResumoRegra", () => ({ ResumoRegra: () => "Parâmetros preservados" }));
vi.mock("./Formularios", () => ({ DecidirMigracao: () => "Decidir migração", ProporMigracao: () => "Formulário de migração" }));
import Page from "./page";

const turma = { nivelId: "nivel", nome: "Turma 1", codigo: "T1", nivel: { idioma: { nome: "Inglês" }, codigo: "A1" }, regraAvaliacao: null };
const proposta = {
  id: "proposta", versao: 2, criadaEm: new Date("2026-10-01T02:30:00.000Z"), preparador: { nome: "Gestora" }, motivo: "Migrar versão", origem: null,
  destino: { versao: 2, conteudo: {} }, alteracoes: [], encontrosRevisados: 1, alocacoesAtivasRevisadas: 1, pendencia: null,
  decisao: { aprovada: true, criadaEm: new Date("2026-10-01T03:30:00.000Z"), decisor: { nome: "Admin" }, motivo: "Conferida" }, podeDecidir: false, podeAprovar: false, estadoHash: "hash",
};

describe("migração de regra da turma", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({});
    mocks.preparar.mockResolvedValue({ ok: true, dado: { turma, pendencia: null, revisao: { origem: null, destino: { id: "destino", versao: 2, conteudo: {} }, alteracoes: [], encontrosRevisados: 1, alocacoesAtivasRevisadas: 1, estadoHash: "hash", versaoEsperada: 1 } } });
    mocks.historico.mockResolvedValue({ ok: true, dado: { propostas: [proposta], pagina: 1, temProxima: false } });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  it("formata apenas proposta e decisão administrativas, preservando comparação e formulário", async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ turmaId: "turma" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("30/09/2026, 20:30");
    expect(html).toContain("30/09/2026, 21:30");
    expect(html).toContain("America/Costa_Rica; origem UTC");
    expect(html).toContain("Formulário de migração");
    expect(html).toContain("Parâmetros preservados");
  });

  it("recorre a UTC sem preferência", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ turmaId: "turma" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("01/10/2026, 02:30");
    expect(html).toContain("UTC; origem UTC");
  });

  it("não consulta preparação, histórico ou preferência antes da guarda", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(Page({ params: Promise.resolve({ turmaId: "turma" }), searchParams: Promise.resolve({}) })).rejects.toThrow("Sem sessão");
    expect(mocks.preparar).not.toHaveBeenCalled();
    expect(mocks.historico).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});