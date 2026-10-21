import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { podeReabrirIntencao } from "./elegibilidade";

describe("reabertura de intenção no despacho", () => {
  it.each(["envio_interrompido", "resultado_incerto", "timeout", "erro_inesperado"])("falha %s permanece em revisão; cron não repete", (motivo) => {
    expect(podeReabrirIntencao("FALHOU", motivo)).toBe(false);
  });
  it("adiamento preserva seu prazo; só simulação/cancelamento corrigível podem renascer", () => {
    expect(podeReabrirIntencao("ADIADA", "fora_da_janela")).toBe(false);
    expect(podeReabrirIntencao("DESPACHADA", null)).toBe(false);
    expect(podeReabrirIntencao("SIMULADA", "ambiente_sem_live")).toBe(true);
    expect(podeReabrirIntencao("CANCELADA", "opt_out")).toBe(true);
  });
});
