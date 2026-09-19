import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), aluno: vi.fn(), matriculas: vi.fn(), config: vi.fn(), usuario: vi.fn(), pedidos: vi.fn(), preferencia: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("não encontrado"); }) }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/alunos/consultas", () => ({ obterAluno: mocks.aluno }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/operacao/fuso", () => ({ FusoInstitucionalSchema: { safeParse: () => ({ success: true, data: "America/Sao_Paulo" }) }, dataCivilInstitucional: () => "2099-01-01" }));
vi.mock("@/lib/prisma", () => ({ prisma: { matricula: { findMany: mocks.matriculas }, configuracaoOperacional: { findUnique: mocks.config }, usuario: { findUnique: mocks.usuario } } }));
vi.mock("@/server/matricula/encerramento-pedidos-consulta", () => ({
  paginaPedidosEncerramento: (valor: string | string[] | undefined) => typeof valor === "string" && /^\d+$/.test(valor) ? Number(valor) : 1,
  listarPedidosEncerramentoParaUsuario: mocks.pedidos,
}));
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
    mocks.pedidos.mockResolvedValue({ pagina: 1, temProxima: true, pedidos: [{ id: "pedido", status: "EM_ACERTO", dataPedido: new Date("2099-01-01T00:00:00.000Z"), dataSolicitada: new Date("2099-01-02T00:00:00.000Z"), motivo: "Encerramento", evidenciaPedido: "Pedido confirmado", motivoRetroatividade: null, evidenciaRetroatividade: null, registrador: { nome: "Secretaria" }, itens: [{ matricula: { id: "matricula", codigo: "M-1" } }] }] });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  it("consulta a preferência depois da guarda e a encaminha aos históricos financeiros do contrato", async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "aluno" }), searchParams: Promise.resolve({}) }));
    expect(mocks.sessao).toHaveBeenCalled();
    expect(mocks.preferencia).toHaveBeenCalledTimes(1);
    expect(mocks.pedidos).toHaveBeenCalledWith({ alunoId: "aluno", pagina: 1 }, expect.objectContaining({ id: "financeiro" }));
    expect(html).toContain('data-mov="America/Costa_Rica"');
    expect(html).toContain('data-compras="America/Costa_Rica"');
    expect(html).toContain('data-cumprimento="America/Costa_Rica"');
    expect(html).toContain('data-acerto="America/Costa_Rica"');
    expect(html).toContain("Registrado por Secretaria em 2099-01-01");
    expect(html).toContain('href="/alunos/aluno/movimentacoes?pagina=2"');
  });

  it("mantém aluno, pedido e navegação para pedidos mais recentes em página posterior", async () => {
    mocks.pedidos.mockResolvedValue({ pagina: 2, temProxima: false, pedidos: [{ id: "pedido-antigo", status: "CONCLUIDA", dataPedido: new Date("2098-12-01T00:00:00.000Z"), dataSolicitada: new Date("2098-12-02T00:00:00.000Z"), motivo: "Pedido histórico", evidenciaPedido: "Evidência preservada", motivoRetroatividade: null, evidenciaRetroatividade: null, registrador: { nome: "Secretaria" }, itens: [{ matricula: { id: "matricula", codigo: "M-1" } }] }] });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "aluno" }), searchParams: Promise.resolve({ pagina: "2" }) }));
    expect(mocks.pedidos).toHaveBeenCalledWith({ alunoId: "aluno", pagina: 2 }, expect.objectContaining({ id: "financeiro" }));
    expect(html).toContain("Pedido histórico");
    expect(html).toContain('href="/alunos/aluno/movimentacoes?pagina=1"');
    expect(html).not.toContain("Mais antigos");
  });

  it("mostra estado vazio e limita parâmetros inválidos à primeira página", async () => {
    mocks.pedidos.mockResolvedValue({ pagina: 1, temProxima: false, pedidos: [] });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "aluno" }), searchParams: Promise.resolve({ pagina: ["2", "3"] }) }));
    expect(mocks.pedidos).toHaveBeenCalledWith({ alunoId: "aluno", pagina: 1 }, expect.objectContaining({ id: "financeiro" }));
    expect(html).toContain("Nenhum pedido registrado nesta página.");
  });

  it("não consulta aluno ou preferência se a guarda recusa", async () => {
    mocks.sessao.mockRejectedValue(new Error("sem acesso"));
    await expect(Page({ params: Promise.resolve({ id: "aluno" }), searchParams: Promise.resolve({}) })).rejects.toThrow("sem acesso");
    expect(mocks.aluno).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
    expect(mocks.pedidos).not.toHaveBeenCalled();
  });
});
