import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ sessao: vi.fn(), config: vi.fn(), cobrancas: vi.fn(), contar: vi.fn(), recebimentos: vi.fn(), eventos: vi.fn(), comissoes: vi.fn() }));
vi.mock("@/server/_shared", async original => ({ ...await original<typeof import("@/server/_shared")>(), exigirSessaoComPapel: m.sessao }));
vi.mock("@/lib/prisma", () => ({ prisma: { configuracaoOperacional: { findUnique: m.config }, cobranca: { findMany: m.cobrancas }, matricula: { count: m.contar }, recebimento: { findMany: m.recebimentos }, evento: { findMany: m.eventos }, comissao: { findMany: m.comissoes } } }));
import { kpisFinanceiro } from "./consultas";

// Q176 (#164): "recebido no mês" e "novas matrículas" contam a partir do dia 1 do mês civil da ESCOLA, nunca do
// servidor (UTC em produção). Na Costa Rica (−06), às 04:30Z de 01/11/2026 ainda são 22h30 de 31/10: o mês é outubro.
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
