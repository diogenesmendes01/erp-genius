import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const m = vi.hoisted(() => ({ sessao: vi.fn(), cobrancas: vi.fn(), matriculas: vi.fn(), contar: vi.fn(), recebimentos: vi.fn(), eventos: vi.fn(), comissoes: vi.fn(), m01: vi.fn(), propostasM01: vi.fn(), vencimentosAditivo: vi.fn(), retomadas: vi.fn() }));
vi.mock("@/server/_shared", async original => ({ ...await original<typeof import("@/server/_shared")>(), exigirSessaoComPapel: m.sessao }));
vi.mock("@/lib/prisma", () => ({ prisma: { cobranca: { findMany: m.cobrancas }, matricula: { findMany: m.matriculas, count: m.contar }, recebimento: { findMany: m.recebimentos }, evento: { findMany: m.eventos }, comissao: { findMany: m.comissoes }, aplicacaoEntradaFinanceiraHistoricaMigracao: { findMany: m.m01 }, propostaEntradaFinanceiraHistoricaMigracao: { findMany: m.propostasM01 }, aplicacaoVencimentoAditivo: { findMany: m.vencimentosAditivo }, propostaRetomadaMatriculas: { findMany: m.retomadas } } }));
import { kpisFinanceiro, listarContextosRecebimentoDestinado } from "./consultas";
const D = (valor: number) => new Prisma.Decimal(valor);
const taxa = (valor: number, credito: number) => ({ id: `taxa-${valor}`, codigo: "TAXA", tipo: "MATRICULA", moeda: "BRL", versao: 1, valorNegociado: D(valor), valorRecebido: D(100), valorLiquidadoCredito: D(0), vencimento: new Date("2099-01-01T00:00:00Z"), origensCreditoAcertoTaxaAditivo: [{ valor: D(credito) }], aplicacoesAcertoTaxaAditivo: [], itemEmissaoEntrada: null, emissaoContinuidadeGerada: null, emissaoFechamentoHoras: null });
beforeEach(() => { vi.resetAllMocks(); m.sessao.mockResolvedValue({ id: "fin", papeis: ["FINANCEIRO"] }); m.m01.mockResolvedValue([]); m.propostasM01.mockResolvedValue([]); m.vencimentosAditivo.mockResolvedValue([]); m.retomadas.mockResolvedValue([]); });
it("oferece o saldo econômico da taxa após crédito sem contar o mesmo pagamento duas vezes", async () => {
  m.matriculas.mockResolvedValue([{ id: "mat", codigo: "MAT-001", status: "AGUARDANDO", moeda: "BRL", aluno: { primeiroNome: "Aluno", sobrenome: "Teste" }, pagadoresPreparacao: [], cobrancas: [taxa(90, 20), taxa(120, 20), taxa(80, 20)] }]);
  const [contexto] = await listarContextosRecebimentoDestinado();
  expect(contexto.cobrancas.map(c => ({ id: c.id, saldo: c.saldo, vencimento: c.vencimento.estado }))).toEqual([{ id: "taxa-90", saldo: 10, vencimento: "A_CONFERIR" }, { id: "taxa-120", saldo: 40, vencimento: "A_CONFERIR" }]);
  expect(contexto.status).toBe("AGUARDANDO");
  expect(contexto.identificacaoMatricula).toBe("MAT-001");
  expect(m.matriculas.mock.calls[0][0].where).toEqual({ status: { in: ["AGUARDANDO", "ATIVA", "PAUSADA"] } });
  expect(m.matriculas.mock.calls[0][0].include.cobrancas.include).toEqual({ origensCreditoAcertoTaxaAditivo: { select: { valor: true } }, aplicacoesAcertoTaxaAditivo: { select: { id: true, aplicadaEm: true, versaoAnterior: true, vencimentoAnterior: true, vencimentoNovo: true } }, itemEmissaoEntrada: { select: { emissao: { select: { memoria: true } } } }, emissaoContinuidadeGerada: { select: { snapshot: true } }, emissaoFechamentoHoras: { select: { memoria: true } } });
});
it("mantém uma identificação estável para matrícula legada sem código", async () => {
  m.matriculas.mockResolvedValue([{ id: "mat-legado", codigo: null, status: "ATIVA", moeda: "BRL", aluno: { primeiroNome: "Aluno", sobrenome: "Teste" }, pagadoresPreparacao: [], cobrancas: [] }]);
  await expect(listarContextosRecebimentoDestinado()).resolves.toMatchObject([{ matriculaId: "mat-legado", identificacaoMatricula: "ID mat-legado" }]);
});
it("projeta M01 sem fuso e deixa a última aplicação de vencimento prevalecer sobre a emissão anterior", async () => {
  const cobranca = { ...taxa(120, 0), id: "c-m01", vencimento: new Date("2099-02-10T00:00:00Z"), itemEmissaoEntrada: { emissao: { memoria: { fusoInstitucional: "America/Costa_Rica", cobrancas: [{ id: "c-m01", vencimento: "2099-01-10" }] } } } };
  m.matriculas.mockResolvedValue([{ id: "mat", codigo: "MAT-001", status: "ATIVA", moeda: "BRL", aluno: { primeiroNome: "Aluno", sobrenome: "Teste" }, pagadoresPreparacao: [], cobrancas: [cobranca] }]);
  m.m01.mockResolvedValue([{ id: "m01-app", cobrancaId: "c-m01", propostaId: "m01", aplicadaEm: new Date("2099-01-01T10:00:00Z") }]);
  m.propostasM01.mockResolvedValue([{ id: "m01", vencimento: new Date("2099-02-10T00:00:00Z") }]);
  await expect(listarContextosRecebimentoDestinado()).resolves.toMatchObject([{ cobrancas: [{ id: "c-m01", vencimento: { estado: "CONFIRMADO", dataCivil: "2099-02-10", fuso: null, origem: "M01_HISTORICO" } }] }]);

  m.matriculas.mockResolvedValue([{ id: "mat", codigo: "MAT-001", status: "ATIVA", moeda: "BRL", aluno: { primeiroNome: "Aluno", sobrenome: "Teste" }, pagadoresPreparacao: [], cobrancas: [{ ...cobranca, vencimento: new Date("2099-02-10T18:00:00Z") }] }]);
  m.vencimentosAditivo.mockResolvedValue([{ id: "aditivo-app", aplicadaEm: new Date("2099-01-02T10:00:00Z"), versaoCobrancaDepois: 1, vencimentoAnterior: new Date("2099-01-10T18:00:00Z"), vencimentoNovo: new Date("2099-02-10T18:00:00Z"), decisao: { proposta: { cobrancaId: "c-m01", fuso: "America/Costa_Rica" } } }]);
  const [contexto] = await listarContextosRecebimentoDestinado();
  expect(contexto.cobrancas[0]?.vencimento).toEqual({ estado: "CONFIRMADO", dataCivil: "2099-02-10", fuso: "America/Costa_Rica", origem: "ADITIVO_VENCIMENTO" });
});
it("separa saldo a receber do caixa original no painel financeiro", async () => {
  m.recebimentos.mockResolvedValue([{ moeda: "BRL", valor: D(100) }]); m.eventos.mockResolvedValue([]); m.comissoes.mockResolvedValue([]); m.contar.mockResolvedValue(0);
  m.cobrancas.mockResolvedValueOnce([taxa(90, 20)]).mockResolvedValueOnce([]);
  const resultado = await kpisFinanceiro();
  expect(resultado.recebidoMes).toEqual([{ moeda: "BRL", valor: 100 }]);
  expect(resultado.aReceber).toEqual([{ moeda: "BRL", valor: 10 }]);
});
