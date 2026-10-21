import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/recuperacao-preparacao-historico", () => ({ consultarHistoricoPreparacaoRecuperacao: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));

import Page from "./page";

const dado = {
  alocacaoId: "alocacao", identificacao: { aluno: "Ana", matriculaId: "matricula", matriculaCodigo: "M1", oferta: "Inglês", turma: "T1", nivel: "A1" },
  historico: [{ id: "autorizacao", autorizador: { nome: "Gestora" }, criadaEm: "2026-10-01T02:30:00.000Z", prazoAte: "2026-10-02T02:30:00.000Z", quantidadePropostas: 1, motivo: "Preparação autorizada." }],
  pagina: 1,
  temProxima: false,
};

describe("histórico de preparação de recuperação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessao.mockResolvedValue({});
    mocks.consultar.mockResolvedValue({ ok: true, dado });
  });

  it("exibe o instante administrativo no fuso pessoal, preservando a origem", async () => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ alocacaoId: "alocacao" }) }));
    expect(html).toContain("30/09/2026, 20:30");
    expect(html).toContain("America/Costa_Rica; origem UTC");
  });

  it("recorre à origem UTC quando a preferência não está disponível", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("01/10/2026, 02:30");
    expect(html).toContain("UTC; origem UTC");
  });

  it("paginação nos dois sentidos sem perder a alocação: primeira só com Próxima; no meio, as duas; da segunda, Anterior sem ?pagina=1", async () => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
    const base = "/academico/recuperacoes/planos/autorizacoes-preparacao?alocacaoId=alocacao";
    mocks.consultar.mockResolvedValue({ ok: true, dado: { ...dado, temProxima: true } });
    const primeira = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ alocacaoId: "alocacao" }) }));
    expect(mocks.consultar).toHaveBeenLastCalledWith({ alocacaoId: "alocacao", pagina: 1 });
    expect(primeira).not.toContain("Anterior");
    expect(primeira).not.toContain("pagina=1");
    expect(primeira).toContain(`href="${base}&amp;pagina=2">Próxima`);

    const meio = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ alocacaoId: "alocacao", pagina: "3" }) }));
    expect(mocks.consultar).toHaveBeenLastCalledWith({ alocacaoId: "alocacao", pagina: 3 });
    expect(meio).toContain(`href="${base}&amp;pagina=2">← Anterior`);
    expect(meio).toContain(`href="${base}&amp;pagina=4">Próxima`);

    mocks.consultar.mockResolvedValue({ ok: true, dado: { ...dado, pagina: 2, temProxima: false } });
    const segunda = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ alocacaoId: "alocacao", pagina: "2" }) }));
    expect(segunda).toContain(`href="${base}">← Anterior`);
    expect(segunda).not.toContain("Próxima");
  });

  it("não consulta histórico ou preferência sem sessão autorizada", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("Sem sessão");
    expect(mocks.consultar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
