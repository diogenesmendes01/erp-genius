import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ sessao: vi.fn(), config: vi.fn(), cobrancas: vi.fn(), contar: vi.fn(), recebimentos: vi.fn(), eventos: vi.fn(), comissoes: vi.fn() }));
vi.mock("@/server/_shared", async original => ({ ...await original<typeof import("@/server/_shared")>(), exigirSessaoComPapel: m.sessao }));
vi.mock("@/lib/prisma", () => ({ prisma: { configuracaoOperacional: { findUnique: m.config }, cobranca: { findMany: m.cobrancas }, matricula: { count: m.contar }, recebimento: { findMany: m.recebimentos }, evento: { findMany: m.eventos }, comissao: { findMany: m.comissoes } } }));
import { kpisFinanceiro } from "./consultas";

beforeEach(() => {
  vi.resetAllMocks();
  m.sessao.mockResolvedValue({ id: "fin", papeis: ["FINANCEIRO"] });
  m.config.mockResolvedValue({ fusoInstitucional: "America/Costa_Rica" });
  m.recebimentos.mockResolvedValue([]); m.eventos.mockResolvedValue([]); m.cobrancas.mockResolvedValue([]); m.comissoes.mockResolvedValue([]); m.contar.mockResolvedValue(0);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T04:30:00Z"));
});
afterEach(() => { vi.useRealTimers(); });

it("o mês dos kpis começa no dia 1 da escola, não no do servidor", async () => {
  await kpisFinanceiro();
  const inicioOutubroNaEscola = new Date("2026-10-01T06:00:00Z");
  expect(m.recebimentos.mock.calls[0][0].where.dataPagamento.gte).toEqual(inicioOutubroNaEscola);
  expect(m.eventos.mock.calls[0][0].where.criadoEm.gte).toEqual(inicioOutubroNaEscola);
  expect(m.contar.mock.calls[0][0].where.ativadaEm.gte).toEqual(inicioOutubroNaEscola);
});

it("às 22h30 da Costa Rica do dia do vencimento, a mensalidade ainda é a receber, não em atraso", async () => {
  const cobranca = { valorNegociado: 100, valorRecebido: 0, valorLiquidadoCredito: 0, valorCompensadoPermuta: 0, moeda: "CRC", origensCreditoAcertoTaxaAditivo: [] };
  m.cobrancas.mockResolvedValue([
    { ...cobranca, vencimento: new Date("2026-10-31T18:00:00Z") },
    { ...cobranca, vencimento: new Date("2026-10-31T00:00:00Z") },
    { ...cobranca, vencimento: new Date("2026-10-30T18:00:00Z") },
  ]);
  const k = await kpisFinanceiro();
  expect(k.emAtraso).toEqual([{ moeda: "CRC", valor: 100 }]);
  expect(k.aReceber).toEqual([{ moeda: "CRC", valor: 200 }]);
});
