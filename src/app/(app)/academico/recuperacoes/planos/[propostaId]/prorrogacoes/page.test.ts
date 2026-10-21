import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn(), fuso: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/recuperacao-prorrogacao-consulta", () => ({ consultarProrrogacoesRecuperacao: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/operacao/consultas", () => ({ consultarFusoInstitucional: mocks.fuso }));

import Page from "./page";

const dado = {
  propostaId: "proposta", disponibilizacaoId: "disponibilizacao", prazoOriginal: "2026-10-01T02:30:00.000Z", prazoVigente: "2026-10-02T02:30:00.000Z", podePropor: false, versaoEsperada: 1, proximaAntesVersao: null,
  identificacao: { aluno: "Ana", matriculaId: "matricula", matriculaCodigo: "M1", oferta: "Inglês", turma: "T1", nivel: "A1" },
  propostas: [{ id: "prorrogacao", versao: 1, preparador: "Prof. Ana", criadaEm: "2026-10-01T02:30:00.000Z", prazoAnterior: "2026-10-01T02:30:00.000Z", novoPrazo: "2026-10-02T02:30:00.000Z", motivo: "Prorrogação necessária.", decisao: { aprovada: true, motivo: "Conferida.", criadaEm: "2026-10-01T03:30:00.000Z", decisor: { nome: "Gestora" } }, podeDecidir: false, podeAprovar: false, propostaHash: null }],
};

describe("prorrogações de recuperação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessao.mockResolvedValue({});
    mocks.consultar.mockResolvedValue({ ok: true, dado });
    mocks.fuso.mockResolvedValue(null);
  });

  it("mostra prazo e decisão no fuso pessoal, com a origem administrativa", async () => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ propostaId: "proposta" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("30/09/2026, 20:30");
    expect(html).toContain("America/Costa_Rica; origem UTC");
    expect(html).not.toContain('name="dataHora"');
  });

  it("usa UTC se a preferência falhar", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ propostaId: "proposta" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("01/10/2026, 02:30");
    expect(html).toContain("UTC; origem UTC");
  });

  it("não inicia consultas antes da guarda de papel", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(Page({ params: Promise.resolve({ propostaId: "proposta" }), searchParams: Promise.resolve({}) })).rejects.toThrow("Sem sessão");
    expect(mocks.consultar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
