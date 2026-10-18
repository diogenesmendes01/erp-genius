import { describe, it, expect } from "vitest";
import { CACHE_CONTROL_SISTEMA, custoMicroUsd, fatorEscritaCache, modeloPermitido, MODELOS_PERMITIDOS } from "./custo";

describe("fatorEscritaCache", () => {
  it("cache_efemero_5_min_sem_ttl_custa_1_25x", () => {
    expect(fatorEscritaCache(undefined)).toBe(1.25);
    expect(fatorEscritaCache("5m")).toBe(1.25);
  });
  it("ttl_1h_custa_2x", () => expect(fatorEscritaCache("1h")).toBe(2));
  it("cache_control_do_sistema_e_efemero_sem_ttl", () =>
    expect(CACHE_CONTROL_SISTEMA).toEqual({ type: "ephemeral" }));
});

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
  it("escrita_de_cache_sonnet_a_1_25x_da_entrada", () =>
    expect(custoMicroUsd("claude-sonnet-5-5", { entrada: 0, cache: 0, saida: 0, escritaCache: 10000 })).toBe(25000));
  it("escrita_de_cache_haiku_a_1_25x_da_entrada", () =>
    expect(custoMicroUsd("claude-haiku-5-5", { entrada: 0, cache: 0, saida: 0, escritaCache: 100000 })).toBe(12500));
  it("escrita_de_cache_soma_ao_restante", () =>
    expect(custoMicroUsd("claude-sonnet-5-5", { entrada: 1000, cache: 10000, saida: 500, escritaCache: 2000 })).toBe(14000));
  it("sem_escrita_de_cache_mantem_custo_anterior", () =>
    expect(custoMicroUsd("claude-sonnet-5-5", { entrada: 1000, cache: 10000, saida: 500, escritaCache: 0 })).toBe(9000));
  it("modelo_permitido", () => {
    expect(modeloPermitido("claude-sonnet-5-5")).toBe(true);
    expect(modeloPermitido("claude-haiku-5-5")).toBe(true);
    expect(modeloPermitido("gpt-x")).toBe(false);
    expect(modeloPermitido("simulado")).toBe(false);
  });
  it("modelos_permitidos", () =>
    expect([...MODELOS_PERMITIDOS]).toEqual(["claude-sonnet-5-5", "claude-haiku-5-5"]));
});
