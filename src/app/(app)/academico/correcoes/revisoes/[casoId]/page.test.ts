import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), listar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/revisao-progressao-consulta", () => ({ consultarCasoRevisaoProgressao: mocks.consultar }));
vi.mock("@/server/avaliacoes/resolucao-revisao-progressao", () => ({ listarPropostasResolucaoRevisaoProgressao: mocks.listar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./ResolucaoRevisaoProgressao", () => ({ ResolucaoRevisaoProgressao: () => null }));

import Page from "./page";

const caso = {
  id: "caso", criadaEm: "2026-10-01T02:30:00.000Z", matricula: { id: "matricula", codigo: "M-1", aluno: { primeiroNome: "Ana", sobrenome: "Souza" } },
  origem: { tipo: "REGULAR", decisaoId: "decisao", alocacaoFonteId: "alocacao" },
  solicitacao: { id: "solicitacao", status: "PENDENTE", turmaOrigem: { nome: "Origem", codigo: "O" }, turmaDestino: { nome: "Destino", codigo: "D" } },
  statusNaCorrecao: "APROVADA", situacao: "PENDENTE_REVISAO", resolucao: null,
};

const renderizar = () => Page({ params: Promise.resolve({ casoId: "caso" }), searchParams: Promise.resolve({}) });

describe("detalhe da revisão de impacto", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({});
    mocks.consultar.mockResolvedValue({ ok: true, dado: caso });
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [], pagina: 1, temMais: false } });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  it("mostra o caso administrativo no fuso pessoal", async () => {
    const html = renderToStaticMarkup(await renderizar());
    expect(html).toMatch(/30\/09\/2026.*20:30/);
    expect(html).toContain("America/Costa_Rica; origem UTC");
    expect(html).toContain("Trajeto informado: Origem para Destino.");
  });

  it("usa UTC sem preferência", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await renderizar());
    expect(html).toMatch(/01\/10\/2026.*02:30/);
    expect(html).toContain("UTC; origem UTC");
  });

  it("não lê caso, histórico ou preferência antes da guarda", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(renderizar()).rejects.toThrow("Sem sessão");
    expect(mocks.consultar).not.toHaveBeenCalled();
    expect(mocks.listar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
