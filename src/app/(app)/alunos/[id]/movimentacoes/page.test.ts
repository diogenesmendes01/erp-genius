import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), aluno: vi.fn(), matriculas: vi.fn(), config: vi.fn(), usuario: vi.fn(), pedidos: vi.fn(), preferencia: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("não encontrado"); }) }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/alunos/consultas", () => ({ obterAluno: mocks.aluno }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/operacao/fuso", () => ({ FusoInstitucionalSchema: { safeParse: () => ({ success: true, data: "America/Sao_Paulo" }) }, dataCivilInstitucional: () => "2099-01-01" }));
vi.mock("@/lib/prisma", () => ({ prisma: { matricula: { findMany: mocks.matriculas }, configuracaoOperacional: { findUnique: mocks.config }, usuario: { findUnique: mocks.usuario }, solicitacaoEncerramentoMatriculas: { findMany: mocks.pedidos } } }));
vi.mock("./MovimentacoesPainel", () => ({ MovimentacoesPainel: ({ preferenciaFusoExibicao }: { preferenciaFusoExibicao?: string | null }) => createElement("p", { "data-mov": preferenciaFusoExibicao ?? "UTC" }) }));
vi.mock("./ComprasHorasPainel", () => ({ ComprasHorasPainel: ({ preferenciaFusoExibicao }: { preferenciaFusoExibicao?: string | null }) => createElement("p", { "data-compras": preferenciaFusoExibicao ?? "UTC" }) }));
vi.mock("./CompensacoesPainel", () => ({ CompensacoesPainel: ({ preferenciaFusoExibicao }: { preferenciaFusoExibicao?: string | null }) => createElement("p", { "data-cumprimento": preferenciaFusoExibicao ?? "UTC" }) }));
vi.mock("./AcertoEncerramento", () => ({ AcertoEncerramento: ({ preferenciaFusoExibicao }: { preferenciaFusoExibicao?: string | null }) => createElement("p", { "data-acerto": preferenciaFusoExibicao ?? "UTC" }) }));
vi.mock("./NovaPausa", () => ({ NovaPausa: () => null }));
vi.mock("./NovaRetomada", () => ({ NovaRetomada: () => null }));
vi.mock("./NovoEncerramento", () => ({ NovoEncerramento: () => null }));
vi.mock("./VinculosLegados", () => ({ VinculosLegados: () => null }));

import Page from "./page";

const contrato = { id: "matricula", codigo: "M-1", status: "ATIVA", produto: { idioma: { nome: "Inglês" }, modalidade: { nome: "Individual" } } };

describe("MovimentacoesPage preferência de fuso", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({ id: "financeiro", papeis: ["FINANCEIRO"] });
    mocks.aluno.mockResolvedValue({ id: "aluno" });
    mocks.matriculas.mockResolvedValue([contrato]);
    mocks.config.mockResolvedValue({ fusoInstitucional: "America/Sao_Paulo" });
    mocks.usuario.mockResolvedValue({ permissoes: ["financeiro.aprovar_acertos"] });
    mocks.pedidos.mockResolvedValue([{ id: "pedido", status: "EM_ACERTO", dataPedido: new Date("2099-01-01T00:00:00.000Z"), dataSolicitada: new Date("2099-01-02T00:00:00.000Z"), motivo: "Encerramento", evidenciaPedido: "Pedido confirmado", motivoRetroatividade: null, evidenciaRetroatividade: null, registrador: { nome: "Secretaria" }, itens: [{ matricula: { id: "matricula", codigo: "M-1" } }] }]);
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  it("consulta a preferência depois da guarda e a encaminha aos históricos financeiros do contrato", async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "aluno" }) }));
    expect(mocks.sessao).toHaveBeenCalled();
    expect(mocks.preferencia).toHaveBeenCalledTimes(1);
    expect(html).toContain('data-mov="America/Costa_Rica"');
    expect(html).toContain('data-compras="America/Costa_Rica"');
    expect(html).toContain('data-cumprimento="America/Costa_Rica"');
    expect(html).toContain('data-acerto="America/Costa_Rica"');
    expect(html).toContain("Registrado por Secretaria em 2099-01-01");
  });

  it("não consulta aluno ou preferência se a guarda recusa", async () => {
    mocks.sessao.mockRejectedValue(new Error("sem acesso"));
    await expect(Page({ params: Promise.resolve({ id: "aluno" }) })).rejects.toThrow("sem acesso");
    expect(mocks.aluno).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});