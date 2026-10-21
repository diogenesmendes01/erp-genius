import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn(), fuso: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/recuperacao-autorizacao-reserva-consulta", () => ({ consultarAutorizacoesReservaRecuperacao: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/operacao/consultas", () => ({ consultarFusoInstitucional: mocks.fuso }));

import Page from "./page";

const dado = {
  propostaId: "proposta", propostaHash: "hash", statusMatricula: "PAUSADA", podeAutorizar: false, habilidades: [],
  identificacao: { aluno: "Ana", matriculaId: "matricula", matriculaCodigo: "M1", oferta: "Inglês", turma: "T1", nivel: "A1" },
  historico: [{ id: "autorizacao", habilidade: "FALA", autorizador: { nome: "Gestora" }, criadaEm: "2026-10-01T02:30:00.000Z", prazoAte: "2026-10-02T02:30:00.000Z", motivo: "Reserva autorizada.", reserva: null, podeReservar: false }],
  pagina: 1,
  temProxima: false,
};

describe("autorização de reserva de recuperação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessao.mockResolvedValue({});
    mocks.consultar.mockResolvedValue({ ok: true, dado });
    mocks.fuso.mockResolvedValue(null);
  });

  it("converte a autorização administrativa sem mudar o formulário de reserva", async () => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ propostaId: "proposta" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("30/09/2026, 20:30");
    expect(html).toContain("America/Costa_Rica; origem UTC");
    expect(html).not.toContain('name="prazoLocal"');
  });

  it("mantém UTC como fallback de um histórico administrativo", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ propostaId: "proposta" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("01/10/2026, 02:30");
    expect(html).toContain("UTC; origem UTC");
  });

  it("paginação nos dois sentidos: primeira só com Próxima; no meio, as duas; da segunda, Anterior sem ?pagina=1", async () => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
    const render = async (busca: Record<string, string>) => renderToStaticMarkup(await Page({ params: Promise.resolve({ propostaId: "proposta/1" }), searchParams: Promise.resolve(busca) }));
    const base = "/academico/recuperacoes/planos/proposta%2F1/autorizacao-reserva";
    mocks.consultar.mockResolvedValue({ ok: true, dado: { ...dado, temProxima: true } });
    const primeira = await render({});
    expect(mocks.consultar).toHaveBeenLastCalledWith({ propostaId: "proposta/1", pagina: 1 });
    expect(primeira).not.toContain("Anterior");
    expect(primeira).not.toContain("pagina=1");
    expect(primeira).toContain(`href="${base}?pagina=2">Próxima`);

    const meio = await render({ pagina: "3" });
    expect(mocks.consultar).toHaveBeenLastCalledWith({ propostaId: "proposta/1", pagina: 3 });
    expect(meio).toContain(`href="${base}?pagina=2">← Anterior`);
    expect(meio).toContain(`href="${base}?pagina=4">Próxima`);

    mocks.consultar.mockResolvedValue({ ok: true, dado: { ...dado, pagina: 2, temProxima: false } });
    const segunda = await render({ pagina: "2" });
    expect(segunda).toContain(`href="${base}">← Anterior`);
    expect(segunda).not.toContain("Próxima");
  });

  it("executa a guarda antes de consultar dados ou preferência", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(Page({ params: Promise.resolve({ propostaId: "proposta" }), searchParams: Promise.resolve({}) })).rejects.toThrow("Sem sessão");
    expect(mocks.consultar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
