import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), listar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({
  exigirSessaoPagina: mocks.sessao,
  temPapel: (usuario: { papeis?: string[] }, papel: string) => usuario.papeis?.includes(papel) ?? false,
}));
vi.mock("@/server/avaliacoes/equivalencia-consulta", () => ({ listarPropostasEquivalencia: mocks.listar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
import Page from "./page";

const proposta = {
  id: "proposta-1",
  versao: 1,
  criadaEm: new Date("2026-10-01T02:30:00.000Z"),
  motivo: "Aproveitamento conferido.",
  turmaOrigem: { codigo: "A1", nome: null },
  turmaDestino: { codigo: "B1", nome: null },
  estado: "APROVADA",
};

const resultado = { ok: true, dado: { itens: [proposta], proximoCursor: null } };

describe("listagem de equivalências", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({ papeis: ["GERENTE_PEDAGOGICO"] });
    mocks.listar.mockResolvedValue(resultado);
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  it("exibe o instante administrativo na preferência pessoal sem alterar o link de execução", async () => {
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ matriculaId: "matricula-1" }) }));

    expect(html).toContain("30/09/2026, 20:30");
    expect(html).toContain("horário exibido em America/Costa_Rica");
    expect(html).toContain('href="/academico/equivalencias/proposta-1"');
    expect(html).toContain("Conferir e efetivar autorização");
  });

  it("mantém São Paulo como referência de exibição quando não há preferência", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Preferência indisponível" });

    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ matriculaId: "matricula-1" }) }));

    expect(html).toContain("30/09/2026, 23:30");
    expect(html).toContain("horário exibido em America/Sao_Paulo");
  });

  it("não consulta propostas ou preferência antes da guarda", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));

    await expect(Page({ searchParams: Promise.resolve({ matriculaId: "matricula-1" }) })).rejects.toThrow("Sem sessão");
    expect(mocks.listar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
