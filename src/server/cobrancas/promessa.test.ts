import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// R1 do #239 (C2): a promessa de pagamento usa o dia da escola, não o relógio do servidor (Q176 · ref. #164).
// Relógio fixo e dependências mockadas; verde com TZ=UTC e TZ=America/Sao_Paulo.

const m = vi.hoisted(() => ({
  cobranca: vi.fn(),
  registrarEvento: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cobranca: { findUnique: m.cobranca },
    configuracaoOperacional: { findUnique: async () => null }, // fusoDaEscola() → America/Sao_Paulo
    $transaction: async (fn: (tx: object) => Promise<unknown>) => fn({}),
  },
}));
vi.mock("@/server/_shared", async (original) => ({
  ...(await original<typeof import("@/server/_shared")>()),
  exigirSessaoComPapel: async () => ({ id: "u-financeiro" }),
  registrarEvento: m.registrarEvento,
}));

import { registrarPromessaPagamento } from "./acoes";

describe("registrarPromessaPagamento no dia da escola", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.cobranca.mockResolvedValue({ id: "c1", status: "ATRASADO" });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-23T02:30:00Z")); // 22/06, 23h30 em Brasília
  });
  afterEach(() => vi.useRealTimers());

  it("às 23h30 de Brasília, \"hoje\" ainda é 22/06: aceita e grava ao meio-dia da escola (15h UTC)", async () => {
    expect(await registrarPromessaPagamento("c1", "2026-06-22")).toEqual({ ok: true });
    expect(m.registrarEvento).toHaveBeenCalledTimes(1);
    expect(m.registrarEvento.mock.calls[0][1]).toMatchObject({
      tipo: "PromessaPagamento",
      agregadoId: "c1",
      payload: { ate: "2026-06-22T15:00:00.000Z" },
    });
  });

  it("aceita a data seguinte, gravada ao meio-dia da escola", async () => {
    expect(await registrarPromessaPagamento("c1", "2026-06-23")).toEqual({ ok: true });
    expect(m.registrarEvento.mock.calls[0][1].payload).toEqual({ ate: "2026-06-23T15:00:00.000Z" });
  });

  it("recusa a véspera da escola como passado", async () => {
    expect(await registrarPromessaPagamento("c1", "2026-06-21")).toEqual({ ok: false, erro: "A data prometida não pode ser no passado." });
    expect(m.registrarEvento).not.toHaveBeenCalled();
  });

  it("recusa 2026-02-30, que não existe no calendário", async () => {
    expect(await registrarPromessaPagamento("c1", "2026-02-30")).toEqual({ ok: false, erro: "Data prometida inválida." });
    expect(m.registrarEvento).not.toHaveBeenCalled();
  });
});
