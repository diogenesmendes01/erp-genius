import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), listar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/revisoes-pendentes", () => ({ listarRevisoesPorCorrecao: mocks.listar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./PrepararCasosHistoricos", () => ({ PrepararCasosHistoricos: () => null }));

import Page from "./page";

const dado = {
  pagina: 1, temProxima: false,
  itens: [{ id: "correcao", tipo: "AULA", versaoCorrecao: 1, decisor: "Gestão", criadaEm: "2026-10-01T02:30:00.000Z", motivo: "Correção aprovada", labelAula: "Aula corrigida", encontroId: "encontro", reposicaoId: null, conclusaoVersao: null, notaRecuperacaoId: null, lancamentoId: null, codigoAvaliacao: null,
    matricula: { id: "matricula", codigo: "M-1", alunoId: "aluno", aluno: { primeiroNome: "Ana", sobrenome: "Souza" } }, impactos: [] }],
};

describe("revisões após correções", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({});
    mocks.listar.mockResolvedValue({ ok: true, dado });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  it("apresenta a aplicação administrativa no fuso pessoal", async () => {
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toMatch(/30\/09\/2026.*20:30/);
    expect(html).toContain("America/Costa_Rica; origem UTC");
    expect(html).toContain('href="/diario/encontros/encontro/correcao"');
  });

  it("recorre a UTC quando não há preferência", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toMatch(/01\/10\/2026.*02:30/);
    expect(html).toContain("UTC; origem UTC");
  });

  it("não lê casos ou preferência antes da guarda", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("Sem sessão");
    expect(mocks.listar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
