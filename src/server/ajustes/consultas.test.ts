import { describe, it, expect, vi, beforeEach } from "vitest";
import { Papel, StatusCobranca } from "@prisma/client";
const { findFirst, authMock, usuarioMock } = vi.hoisted(() => ({ findFirst: vi.fn(), authMock: vi.fn(), usuarioMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  aluno: { findFirst }, usuario: { findUnique: usuarioMock },
  pagamentoInformado: { groupBy: () => Promise.resolve([]) },
  evento: { findMany: () => Promise.resolve([]) }, politicaRegua: { findFirst: () => Promise.resolve(null) },
  aplicacaoEntradaFinanceiraHistoricaMigracao: { findMany: () => Promise.resolve([]) },
  aplicacaoVencimentoAditivo: { findMany: () => Promise.resolve([]) },
  propostaRetomadaMatriculas: { findMany: () => Promise.resolve([]) },
  propostaEntradaFinanceiraHistoricaMigracao: { findMany: () => Promise.resolve([]) },
} }));
import { escopoFichaFinanceira, obterFichaFinanceira } from "./consultas";
const u = (id: string, ...papeis: Papel[]) => ({ id, nome: "T", papeis });
const negar = { id: { in: [] } };

describe("projeção financeira operacional — política 36", () => {
  beforeEach(() => { vi.clearAllMocks(); authMock.mockResolvedValue({ user: { id: "fin" } }); usuarioMock.mockResolvedValue({ nome: "FIN", ativo: true, papeis: [Papel.FINANCEIRO] }); });
  it("ausência de identidade nega por padrão", () => expect(escopoFichaFinanceira()).toEqual(negar));
  it.each([Papel.VENDEDOR, Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO, Papel.GERENTE_COMERCIAL])("%s usa projeção própria, sem obter extrato operacional", (papel) => {
    expect(escopoFichaFinanceira(u("u", papel))).toEqual(negar);
  });
  it.each([Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR])("%s pode consultar atendimento financeiro individual", (papel) => {
    expect(escopoFichaFinanceira(u("u", papel))).toEqual({});
  });
  it("sessão antiga de vendedor não chega à consulta de valores", async () => {
    usuarioMock.mockResolvedValue({ nome: "VEN", ativo: true, papeis: [Papel.VENDEDOR] });
    await expect(obterFichaFinanceira("aluno", u("fin", Papel.FINANCEIRO))).rejects.toThrow(/permissão/);
    expect(findFirst).not.toHaveBeenCalled();
  });
  it("usuário desativado é barrado antes do banco financeiro", async () => {
    usuarioMock.mockResolvedValue({ nome: "FIN", ativo: false, papeis: [Papel.FINANCEIRO] });
    await expect(obterFichaFinanceira("aluno")).rejects.toThrow(/autenticado/);
    expect(findFirst).not.toHaveBeenCalled();
  });
  it("recusa identidade passada diferente da sessão", async () => {
    expect(await obterFichaFinanceira("aluno", u("outro", Papel.FINANCEIRO))).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });
  it("KPIs individuais usam saldo após pagamento parcial", async () => {
    findFirst.mockResolvedValue({ id: "aluno", pais: { nome: "BR" }, responsaveis: [], matriculas: [{ id: "m", comissoes: [], ajustes: [], acessoBloqueado: false, cobrancas: [{ id: "c", status: StatusCobranca.PENDENTE, vencimento: new Date("2030-01-01"), valorNegociado: 100, valorRecebido: 40, origensCreditoAcertoTaxaAditivo: [], moeda: "BRL", pagoEm: null }] }] });
    const f = await obterFichaFinanceira("aluno");
    expect(f?.emAberto).toEqual([{ moeda: "BRL", valor: 60 }]);
  });
  it("não oculta o saldo de taxa cujo pagamento também originou crédito", async () => {
    findFirst.mockResolvedValue({ id: "aluno", pais: { nome: "BR" }, responsaveis: [], matriculas: [{ id: "m", comissoes: [], ajustes: [], acessoBloqueado: false, cobrancas: [{ id: "c", status: StatusCobranca.PENDENTE, vencimento: new Date("2099-01-01"), valorNegociado: 90, valorRecebido: 100, valorLiquidadoCredito: 0, origensCreditoAcertoTaxaAditivo: [{ valor: 20 }], moeda: "BRL", pagoEm: null }] }] });
    const ficha = await obterFichaFinanceira("aluno");
    expect(ficha?.emAberto).toEqual([{ moeda: "BRL", valor: 10 }]);
    expect(findFirst.mock.calls[0][0].select.matriculas.include.cobrancas.include.origensCreditoAcertoTaxaAditivo).toEqual({ select: { valor: true } });
  });
  it("aluno inexistente não devolve estrutura com dados de outro", async () => {
    findFirst.mockResolvedValue(null);
    expect(await obterFichaFinanceira("ausente")).toBeNull();
  });
});
