import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarEspera } from "./espera";

describe("criarEspera (debounce dos selects)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("setas do teclado: só a última mudança dispara, depois da pausa", () => {
    const espera = criarEspera(400), acao = vi.fn();
    espera.agendar(() => acao("ATIVO"));
    vi.advanceTimersByTime(200);
    espera.agendar(() => acao("PAUSADO"));
    vi.advanceTimersByTime(399);
    expect(acao).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(acao).toHaveBeenCalledTimes(1);
    expect(acao).toHaveBeenCalledWith("PAUSADO");
  });

  it("cancelar (Voltar do navegador dentro da pausa) descarta a navegação pendente", () => {
    const espera = criarEspera(400), acao = vi.fn();
    espera.agendar(acao);
    expect(espera.pendente).toBe(true);
    espera.cancelar();
    vi.advanceTimersByTime(1000);
    expect(acao).not.toHaveBeenCalled();
    expect(espera.pendente).toBe(false);
  });
});
