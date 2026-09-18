import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const m = vi.hoisted(() => ({ sessao: vi.fn(), cobrancas: vi.fn(), matriculas: vi.fn(), contar: vi.fn(), recebimentos: vi.fn(), eventos: vi.fn(), comissoes: vi.fn() }));
vi.mock("@/server/_shared", async original => ({ ...await original<typeof import("@/server/_shared")>(), exigirSessaoComPapel: m.sessao }));
vi.mock("@/lib/prisma", () => ({ prisma: { cobranca: { findMany: m.cobrancas }, matricula: { findMany: m.matriculas, count: m.contar }, recebimento: { findMany: m.recebimentos }, evento: { findMany: m.eventos }, comissao: { findMany: m.comissoes } } }));
import { kpisFinanceiro, listarContextosRecebimentoDestinado } from "./consultas";
const D = (valor: number) => new Prisma.Decimal(valor);
const taxa = (valor: number, credito: number) => ({ id: `taxa-${valor}`, codigo: "TAXA", tipo: "MATRICULA", moeda: "BRL", valorNegociado: D(valor), valorRecebido: D(100), valorLiquidadoCredito: D(0), vencimento: new Date("2099-01-01T00:00:00Z"), origensCreditoAcertoTaxaAditivo: [{ valor: D(credito) }], itemEmissaoEntrada: null, emissaoContinuidadeGerada: null, emissaoFechamentoHoras: null });
beforeEach(() => { vi.resetAllMocks(); m.sessao.mockResolvedValue({ id: "fin", papeis: ["FINANCEIRO"] }); });
it("oferece o saldo econômico da taxa após crédito sem contar o mesmo pagamento duas vezes", async () => {
  m.matriculas.mockResolvedValue([{ id: "mat", codigo: "MAT-001", status: "AGUARDANDO", moeda: "BRL", aluno: { primeiroNome: "Aluno", sobrenome: "Teste" }, pagadoresPreparacao: [], cobrancas: [taxa(90, 20), taxa(120, 20), taxa(80, 20)] }]);
  const [contexto] = await listarContextosRecebimentoDestinado();
  expect(contexto.cobrancas.map(c => ({ id: c.id, saldo: c.saldo, vencimento: c.vencimento.estado }))).toEqual([{ id: "taxa-90", saldo: 10, vencimento: "A_CONFERIR" }, { id: "taxa-120", saldo: 40, vencimento: "A_CONFERIR" }]);
  expect(contexto.status).toBe("AGUARDANDO");
  expect(contexto.identificacaoMatricula).toBe("MAT-001");
  expect(m.matriculas.mock.calls[0][0].where).toEqual({ status: { in: ["AGUARDANDO", "ATIVA", "PAUSADA"] } });
  expect(m.matriculas.mock.calls[0][0].include.cobrancas.include).toEqual({ origensCreditoAcertoTaxaAditivo: { select: { valor: true } }, itemEmissaoEntrada: { select: { emissao: { select: { memoria: true } } } }, emissaoContinuidadeGerada: { select: { snapshot: true } }, emissaoFechamentoHoras: { select: { memoria: true } } });
});
it("mantém uma identificação estável para matrícula legada sem código", async () => {
  m.matriculas.mockResolvedValue([{ id: "mat-legado", codigo: null, status: "ATIVA", moeda: "BRL", aluno: { primeiroNome: "Aluno", sobrenome: "Teste" }, pagadoresPreparacao: [], cobrancas: [] }]);
  await expect(listarContextosRecebimentoDestinado()).resolves.toMatchObject([{ matriculaId: "mat-legado", identificacaoMatricula: "ID mat-legado" }]);
});
it("separa saldo a receber do caixa original no painel financeiro", async () => {
  m.recebimentos.mockResolvedValue([{ moeda: "BRL", valor: D(100) }]); m.eventos.mockResolvedValue([]); m.comissoes.mockResolvedValue([]); m.contar.mockResolvedValue(0);
  m.cobrancas.mockResolvedValueOnce([taxa(90, 20)]).mockResolvedValueOnce([]);
  const resultado = await kpisFinanceiro();
  expect(resultado.recebidoMes).toEqual([{ moeda: "BRL", valor: 100 }]);
  expect(resultado.aReceber).toEqual([{ moeda: "BRL", valor: 10 }]);
});
