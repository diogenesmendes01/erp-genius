import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ reservas: vi.fn(), realizacoes: vi.fn() }));
vi.mock("@/server/_shared", async (original) => ({
  ...(await original<typeof import("@/server/_shared")>()),
  exigirSessaoComPapel: vi.fn().mockResolvedValue({ id: "gestora" }),
  executarAcao: async (fn: () => Promise<unknown>) => ({ ok: true, dado: await fn() }),
}));
vi.mock("./lancamento-tx", () => ({ bloquearLancamento: vi.fn().mockResolvedValue({ id: "aloc", matriculaId: "m", turmaId: "t" }) }));
vi.mock("./regras-tx", () => ({ conferirGestorAvaliacao: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn({
  reservaSegundaChamada: { findFirst: vi.fn(), findMany: mocks.reservas },
  realizacaoSegundaChamada: { findMany: mocks.realizacoes },
  configuracaoOperacional: { findUnique: vi.fn().mockResolvedValue({ fusoInstitucional: "UTC" }) },
}) } }));

import { consultarHistoricoReservasSegundaChamada } from "./segunda-chamada-historico";

const impedida = {
  id: "r1", status: "PENDENCIA_ESCOLA", regraId: "regra-a", reservadaEm: new Date("2026-10-01T12:00:00Z"), reservadaPor: { nome: "Gestão" },
  agenda: null, resolucaoImpedimento: null, realizacao: null,
  ocorrencias: [{ status: "PENDENCIA_ESCOLA", ocorridaEm: new Date("2026-10-01T13:00:00Z"), criadaEm: new Date("2026-10-01T13:00:00Z"), motivo: "Impedimento", evidencia: "Ata", registradaPor: { nome: "Gestão" } }],
};
const realizacao = (id: string, regraId: string) => ({ id, reservaId: `reserva-${id}`, realizadaEm: new Date("2026-10-05T12:00:00Z"), reserva: { regraId } });

describe("consultarHistoricoReservasSegundaChamada (Q164, C4 da #265)", () => {
  beforeEach(() => {
    mocks.reservas.mockResolvedValue([impedida]);
    mocks.realizacoes.mockResolvedValue([realizacao("mesma", "regra-a"), realizacao("outra", "regra-b")]);
  });

  it("só oferece realização da mesma regra de avaliação da reserva impedida", async () => {
    const r = await consultarHistoricoReservasSegundaChamada({ alocacaoId: "aloc", codigoAvaliacao: "I1" });
    expect(r).toMatchObject({ ok: true, dado: { itens: [{ id: "r1", realizacoesQueResolvem: [{ id: "mesma" }] }] } });
    if (!r.ok || !r.dado) throw new Error("sem dado");
    expect(r.dado.itens[0].realizacoesQueResolvem).toHaveLength(1);
  });
});
