import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn(), fuso: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/lancamentos", () => ({ consultarLancamentosAvaliacao: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/operacao/consultas", () => ({ consultarFusoInstitucional: mocks.fuso }));
vi.mock("./Formularios", () => ({
  LancarNotas: ({ fuso, anterior }: { fuso: string; anterior: { realizadaEm: string } | null }) => createElement("p", { "data-testid": "lancar-notas" }, `entrada=${fuso}; anterior=${anterior?.realizadaEm}`),
  ConferirNotas: () => null,
}));
vi.mock("../../Identificacao", () => ({ IdentificacaoAvaliacao: () => null }));

import Page from "./page";

const dado = {
  contexto: {
    turma: "Turma A", regraVersao: 2,
    avaliacao: { titulo: "Avaliação final", habilidades: ["FALA"] },
    escala: { minimo: "0", maximo: "10" },
  },
  identificacao: {}, versaoEsperada: 1, oficial: false, podeGerirDesignacao: true, podeLancar: true,
  realizadores: [], registradorId: "professor", pagina: 1, temProxima: true,
  versoes: [{
    id: "versao", versao: 1, realizadaEm: new Date("2026-10-01T02:30:00.000Z"), criadaEm: new Date("2026-10-01T03:30:00.000Z"),
    notas: [{ habilidade: "FALA", nota: "8", comentarioAluno: "Bom" }], submetida: true, conteudoHash: "a".repeat(64),
    realizadaPor: null, motivoRegularizacao: null, evidenciasRegularizacao: null,
    autor: { id: "professor", nome: "Ana" }, decisao: { aprovada: true, motivo: "Conferida", criadaEm: new Date("2026-10-01T04:30:00.000Z"), decisor: { id: "gestao", nome: "Bia" } },
    vigente: null, podeDecidir: false, podeAprovar: false,
  }],
};

const renderizar = (busca: { pagina?: string; fuso?: string } = {}) => Page({
  params: Promise.resolve({ alocacaoId: "alocacao", codigo: "final" }),
  searchParams: Promise.resolve(busca),
});

describe("lançamentos de avaliação", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({ id: "professor" });
    mocks.consultar.mockResolvedValue({ ok: true, dado });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    mocks.fuso.mockResolvedValue(null);
  });

  it("usa a preferência somente no histórico e conserva UTC como entrada explícita", async () => {
    const html = renderToStaticMarkup(await renderizar({ fuso: "UTC" }));
    expect(html).toMatch(/30\/09\/2026.*20:30/);
    expect(html).toContain("Fuso de exibição do histórico: America/Costa_Rica (origem UTC).");
    expect(html).toContain("Fuso para informar horários");
    expect(html).toContain('name="fuso"');
    expect(html).toContain('value="UTC"');
    expect(html).toContain("entrada=UTC");
    expect(html).toContain("anterior=2026-10-01T02:30");
    expect(html).toContain('href="?fuso=UTC&amp;pagina=2"');
    expect(html).toContain('href="/academico/avaliacoes/alocacao/final/designacao"');
    expect(mocks.fuso).not.toHaveBeenCalled();
  });

  it("recorre ao fuso informado para o histórico sem preferência e preserva São Paulo na entrada", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await renderizar({ fuso: "America/Sao_Paulo" }));
    expect(html).toMatch(/30\/09\/2026.*23:30/);
    expect(html).toContain("Fuso de exibição do histórico: America/Sao_Paulo (origem UTC).");
    expect(html).toContain('value="America/Sao_Paulo"');
    expect(html).toContain("entrada=America/Sao_Paulo");
    expect(html).toContain("anterior=2026-09-30T23:30");
    expect(mocks.fuso).not.toHaveBeenCalled();
  });

  it("não consulta lançamentos, preferência ou fuso institucional quando a guarda falha", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(renderizar()).rejects.toThrow("Sem sessão");
    expect(mocks.consultar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
    expect(mocks.fuso).not.toHaveBeenCalled();
  });

  it("recusa fuso de entrada inválido sem consultar dados ou preferência", async () => {
    const html = renderToStaticMarkup(await renderizar({ fuso: "Factory" }));
    expect(html).toContain("Fuso inválido");
    expect(mocks.consultar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
    expect(mocks.fuso).not.toHaveBeenCalled();
  });

  it("sem fuso na URL, usa o fuso institucional configurado como entrada padrão", async () => {
    mocks.fuso.mockResolvedValue("America/Sao_Paulo");
    const html = renderToStaticMarkup(await renderizar({}));
    expect(html).toContain('value="America/Sao_Paulo"');
    expect(html).toContain("entrada=America/Sao_Paulo");
  });

  it("sem fuso na URL e sem fuso institucional configurado, recorre a UTC", async () => {
    mocks.fuso.mockResolvedValue(null);
    const html = renderToStaticMarkup(await renderizar({}));
    expect(html).toContain('value="UTC"');
    expect(html).toContain("entrada=UTC");
  });
});
