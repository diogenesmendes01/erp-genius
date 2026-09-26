import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("./inbound", () => ({ acharNumero: vi.fn() }));

import { dentroDaJanelaHistorico, JANELA_HISTORICO_DIAS } from "./historico";

// SPEC-ERP-005 LC-D04: só os últimos 30 dias do histórico do aparelho.
describe("dentroDaJanelaHistorico", () => {
  const agora = new Date("2026-09-26T12:00:00.000Z");
  const dia = 86_400_000;

  it("janela de 30 dias, inclusive a borda", () => {
    expect(JANELA_HISTORICO_DIAS).toBe(30);
    expect(dentroDaJanelaHistorico(new Date(agora.getTime() - 30 * dia), agora)).toBe(true);
    expect(dentroDaJanelaHistorico(new Date(agora.getTime() - 30 * dia - 1), agora)).toBe(false);
    expect(dentroDaJanelaHistorico(new Date(agora.getTime() - dia), agora)).toBe(true);
  });

  it("recusa data inválida e mensagem 'do futuro' além da folga de relógio", () => {
    expect(dentroDaJanelaHistorico(new Date("invalida"), agora)).toBe(false);
    expect(dentroDaJanelaHistorico(new Date(agora.getTime() + 60_000), agora)).toBe(true);
    expect(dentroDaJanelaHistorico(new Date(agora.getTime() + dia), agora)).toBe(false);
  });
});
