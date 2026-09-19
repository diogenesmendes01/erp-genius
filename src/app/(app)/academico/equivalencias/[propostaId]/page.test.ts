import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/equivalencia-consulta", () => ({ consultarPropostaEquivalencia: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./AcoesEquivalencia", () => ({
  AcoesEquivalencia: ({ propostaId, podeExecutar }: { propostaId: string; podeExecutar: boolean }) => `Ações ${propostaId}: ${podeExecutar ? "executar" : "consultar"}`,
}));
import Page from "./page";

const proposta = {
  id: "proposta-1",
  matricula: { codigo: "MAT-1" },
  turmaOrigem: { codigo: "A1", nome: null },
  turmaDestino: { codigo: "B1", nome: null },
  versao: 1,
  criadaEm: new Date("2026-10-01T02:30:00.000Z"),
  motivo: "Aproveitamento conferido.",
  estado: "APLICADA",
  visao: "EXECUCAO" as const,
  snapshot: {},
  mapeamentos: [],
  decisao: {
    id: "decisao-1",
    aprovada: true,
    decididaEm: new Date("2026-10-01T03:30:00.000Z"),
    motivo: "Autorização independente.",
    aplicacao: { aplicadaEm: new Date("2026-10-01T04:30:00.000Z") },
  },
  podeDecidir: false,
  podeExecutar: true,
};

describe("detalhe da equivalência", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({});
    mocks.consultar.mockResolvedValue({ ok: true, dado: proposta });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  it("exibe criação, decisão e execução no fuso pessoal e preserva a ação", async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ propostaId: "proposta-1" }) }));

    expect(html).toContain("30/09/2026, 20:30");
    expect(html).toContain("30/09/2026, 21:30");
    expect(html).toContain("30/09/2026, 22:30");
    expect(html).toContain("horário exibido em America/Costa_Rica");
    expect(html).toContain("Ações proposta-1: executar");
    expect(html).toContain("A Secretaria recebe apenas os dados necessários");
  });

  it("mantém São Paulo como referência de exibição quando a preferência não está disponível", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Preferência indisponível" });

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ propostaId: "proposta-1" }) }));

    expect(html).toContain("30/09/2026, 23:30");
    expect(html).toContain("horário exibido em America/Sao_Paulo");
  });

  it("não consulta proposta ou preferência antes da guarda", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));

    await expect(Page({ params: Promise.resolve({ propostaId: "proposta-1" }) })).rejects.toThrow("Sem sessão");
    expect(mocks.consultar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
