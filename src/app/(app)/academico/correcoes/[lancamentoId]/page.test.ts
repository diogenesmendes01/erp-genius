import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/correcao-consulta", () => ({ consultarCorrecoesNota: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./Formularios", () => ({ ProporCorrecao: () => null }));

import Page from "./page";

const dado = {
  alocacaoId: "alocacao", codigoAvaliacao: "final", titulo: "Avaliação final", escala: { minimo: 0, maximo: 10 },
  identificacao: { aluno: "Ana", matriculaId: "matricula", matriculaCodigo: "M-1", oferta: "Inglês", turma: "Turma 1", nivel: "A1" },
  pagina: 1, temProxima: false, versaoEsperada: 2, vigente: { origemHash: "a".repeat(64), notas: [] },
  propostas: [{ id: "proposta", versao: 2, autor: { nome: "Professora" }, criadaEm: "2026-10-01T02:30:00.000Z", motivo: "Nota corrigida", notas: [{ habilidade: "FALA", nota: "8.00", comentarioAluno: "Melhoria" }], anteriores: [{ habilidade: "FALA", nota: "7.00", comentarioAluno: "Anterior" }], decisao: { decisor: { nome: "Gestão" }, criadaEm: "2026-10-01T03:30:00.000Z", motivo: "Aprovada" }, podeRevisar: true }],
};

describe("correções de nota", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({});
    mocks.consultar.mockResolvedValue({ ok: true, dado });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  it("apresenta proposta e decisão administrativas no fuso pessoal sem mudar as notas", async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ lancamentoId: "lancamento" }), searchParams: Promise.resolve({}) }));
    expect(html).toMatch(/30\/09\/2026.*20:30/);
    expect(html).toContain("America/Costa_Rica; origem UTC");
    expect(html).toContain("Fala: 7.00 → 8.00");
    expect(html).toContain('href="/academico/correcoes/lancamento/proposta"');
  });

  it("usa UTC sem preferência", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ lancamentoId: "lancamento" }), searchParams: Promise.resolve({}) }));
    expect(html).toMatch(/01\/10\/2026.*02:30/);
    expect(html).toContain("UTC; origem UTC");
  });

  it("não consulta correções ou preferência antes da guarda", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(Page({ params: Promise.resolve({ lancamentoId: "lancamento" }), searchParams: Promise.resolve({}) })).rejects.toThrow("Sem sessão");
    expect(mocks.consultar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
