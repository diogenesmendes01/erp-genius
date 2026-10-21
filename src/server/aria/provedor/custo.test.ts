import { describe, it, expect } from "vitest";
import {
  CACHE_CONTROL_SISTEMA,
  custoMicroUsd,
  fatorEscritaCache,
  LIMITE_PROMPT_HAIKU_FAIXA_BAIXA,
  modeloPermitido,
  MODELOS_PERMITIDOS,
  precoPorMilhao,
} from "./custo";

describe("fatorEscritaCache", () => {
  it("cache_efemero_5_min_sem_ttl_custa_1_25x", () => {
    expect(fatorEscritaCache(undefined)).toBe(1.25);
    expect(fatorEscritaCache("5m")).toBe(1.25);
  });
  it("ttl_1h_custa_2x", () => expect(fatorEscritaCache("1h")).toBe(2));
  it("cache_control_do_sistema_e_efemero_sem_ttl", () =>
    expect(CACHE_CONTROL_SISTEMA).toEqual({ type: "ephemeral" }));
});

// Tabela oficial: platform.claude.com/docs/en/about-claude/pricing (consultada em 18/10/2026), USD por milhão de tokens.
describe("precoPorMilhao: tabela oficial", () => {
  const linha = (modelo: string, tokensPrompt: number) => {
    const p = precoPorMilhao(modelo, tokensPrompt);
    return {
      entrada: p.entrada,
      escrita5m: p.entrada * fatorEscritaCache("5m"),
      escrita1h: p.entrada * fatorEscritaCache("1h"),
      leituraCache: p.cache,
      saida: p.saida,
    };
  };
  it("sonnet_5_5", () =>
    expect(linha("claude-sonnet-5-5", 1000)).toEqual({ entrada: 2, escrita5m: 2.5, escrita1h: 4, leituraCache: 0.1, saida: 10 }));
  it("sonnet_5_5_sem_faixa_de_prompt_longo", () =>
    expect(precoPorMilhao("claude-sonnet-5-5", 900_000)).toEqual(precoPorMilhao("claude-sonnet-5-5", 1000)));
  it("haiku_5_5_ate_100_mil", () =>
    expect(linha("claude-haiku-5-5", 100_000)).toEqual({ entrada: 0.1, escrita5m: 0.125, escrita1h: 0.2, leituraCache: 0.01, saida: 0.5 }));
  it("haiku_5_5_acima_de_100_mil", () =>
    expect(linha("claude-haiku-5-5", 100_001)).toEqual({ entrada: 0.5, escrita5m: 0.625, escrita1h: 1, leituraCache: 0.05, saida: 2.5 }));
  it("limite_da_faixa_baixa_e_100_mil", () => expect(LIMITE_PROMPT_HAIKU_FAIXA_BAIXA).toBe(100_000));
  it("desconhecido_falha", () => expect(() => precoPorMilhao("gpt-x", 1)).toThrow());
});

describe("custoMicroUsd: faixa de prompt do Haiku 5.5", () => {
  // Prompt = entrada + leitura de cache + escrita de cache (todos os tokens de entrada enviados ao modelo); a saída não conta.
  const base = { entrada: 40_000, cache: 50_000, escritaCache: 10_000, saida: 1000 };
  it("prompt_de_100_000_fica_na_faixa_baixa", () =>
    // 40000×0,10 + 50000×0,01 + 10000×0,125 + 1000×0,50
    expect(custoMicroUsd("claude-haiku-5-5", base)).toBe(6250));
  it("prompt_de_100_001_usa_a_faixa_alta_em_todas_as_categorias", () =>
    // 40001×0,50 + 50000×0,05 + 10000×0,625 + 1000×2,50 = 31250,5
    expect(custoMicroUsd("claude-haiku-5-5", { ...base, entrada: 40_001 })).toBe(31251));
  it("leitura_de_cache_conta_para_a_faixa", () =>
    expect(custoMicroUsd("claude-haiku-5-5", { entrada: 1, cache: 100_000, saida: 0 })).toBe(Math.round(0.5 + 100_000 * 0.05)));
  it("escrita_de_cache_conta_para_a_faixa", () =>
    expect(custoMicroUsd("claude-haiku-5-5", { entrada: 1, cache: 0, saida: 0, escritaCache: 100_000 })).toBe(Math.round(0.5 + 100_000 * 0.625)));
  it("saida_nao_conta_para_a_faixa", () =>
    expect(custoMicroUsd("claude-haiku-5-5", { entrada: 100_000, cache: 0, saida: 200_000 })).toBe(10_000 + 100_000));
  it("sonnet_nao_muda_de_preco_com_prompt_longo", () =>
    expect(custoMicroUsd("claude-sonnet-5-5", { entrada: 200_000, cache: 0, saida: 0 })).toBe(400_000));
});

describe("custoMicroUsd", () => {
  it("leitura_de_cache_sonnet_a_0_05x_da_entrada", () =>
    expect(custoMicroUsd("claude-sonnet-5-5", { entrada: 0, cache: 1_000_000, saida: 0 })).toBe(100_000));
  it("custo_sonnet", () =>
    expect(custoMicroUsd("claude-sonnet-5-5", { entrada: 1000, cache: 10000, saida: 500 })).toBe(8000));
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
    expect(custoMicroUsd("claude-sonnet-5-5", { entrada: 1000, cache: 10000, saida: 500, escritaCache: 2000 })).toBe(13000));
  it("sem_escrita_de_cache_mantem_custo_anterior", () =>
    expect(custoMicroUsd("claude-sonnet-5-5", { entrada: 1000, cache: 10000, saida: 500, escritaCache: 0 })).toBe(8000));
  it("modelo_permitido", () => {
    expect(modeloPermitido("claude-sonnet-5-5")).toBe(true);
    expect(modeloPermitido("claude-haiku-5-5")).toBe(true);
    expect(modeloPermitido("gpt-x")).toBe(false);
    expect(modeloPermitido("simulado")).toBe(false);
  });
  it("modelos_permitidos", () =>
    expect([...MODELOS_PERMITIDOS]).toEqual(["claude-sonnet-5-5", "claude-haiku-5-5"]));
});
