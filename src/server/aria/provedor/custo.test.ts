import { describe, it, expect } from "vitest";
import { custoMicroUsd, MODELOS_PERMITIDOS } from "./custo";

describe("custoMicroUsd", () => {
  it("custo_sonnet", () =>
    expect(custoMicroUsd("claude-sonnet-5-5", { entrada: 1000, cache: 10000, saida: 500 })).toBe(9000));
  it("custo_haiku", () =>
    expect(custoMicroUsd("claude-haiku-5-5", { entrada: 2000, cache: 0, saida: 100 })).toBe(250));
  it("cache_haiku_estimado_em_10_por_cento_da_entrada", () =>
    expect(custoMicroUsd("claude-haiku-5-5", { entrada: 0, cache: 100000, saida: 0 })).toBe(1000));
  it("simulado_zero_e_desconhecido_falha", () => {
    expect(custoMicroUsd("simulado", { entrada: 9, cache: 0, saida: 9 })).toBe(0);
    expect(() => custoMicroUsd("gpt-x", { entrada: 1, cache: 0, saida: 1 })).toThrow();
  });
  it("modelos_permitidos", () =>
    expect([...MODELOS_PERMITIDOS]).toEqual(["claude-sonnet-5-5", "claude-haiku-5-5"]));
});
