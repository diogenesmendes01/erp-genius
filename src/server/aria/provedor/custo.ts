export const MODELOS_PERMITIDOS = ["claude-sonnet-5-5", "claude-haiku-5-5"] as const;

export type ModeloPermitido = (typeof MODELOS_PERMITIDOS)[number];

export function modeloPermitido(modelo: string): modelo is ModeloPermitido {
  return (MODELOS_PERMITIDOS as readonly string[]).includes(modelo);
}

export type TtlCache = "5m" | "1h";

export const CACHE_CONTROL_SISTEMA: { readonly type: "ephemeral"; readonly ttl?: TtlCache } = Object.freeze({
  type: "ephemeral",
});

export function fatorEscritaCache(ttl: TtlCache | undefined): number {
  return ttl === "1h" ? 2 : 1.25;
}

const FATOR_ESCRITA_CACHE = fatorEscritaCache(CACHE_CONTROL_SISTEMA.ttl);

export interface Preco {
  entrada: number;
  cache: number;
  saida: number;
}

export const LIMITE_PROMPT_HAIKU_FAIXA_BAIXA = 100_000;

interface Faixas {
  base: Preco;
  promptLongo?: Preco;
}

const PRECOS: Record<ModeloPermitido, Faixas> = {
  "claude-sonnet-5-5": { base: { entrada: 2, cache: 0.1, saida: 10 } },
  "claude-haiku-5-5": {
    base: { entrada: 0.1, cache: 0.01, saida: 0.5 },
    promptLongo: { entrada: 0.5, cache: 0.05, saida: 2.5 },
  },
};

export function precoPorMilhao(modelo: string, tokensPrompt: number): Preco {
  const f = (PRECOS as Record<string, Faixas | undefined>)[modelo];
  if (!f) throw new Error(`Modelo sem preço cadastrado: ${modelo}`);
  return f.promptLongo && tokensPrompt > LIMITE_PROMPT_HAIKU_FAIXA_BAIXA ? f.promptLongo : f.base;
}

export function custoMicroUsd(
  modelo: string,
  t: { entrada: number; cache: number; saida: number; escritaCache?: number },
): number {
  if (modelo === "simulado") return 0;
  const escritaCache = t.escritaCache ?? 0;
  const p = precoPorMilhao(modelo, t.entrada + t.cache + escritaCache);
  const escrita = escritaCache * p.entrada * FATOR_ESCRITA_CACHE;
  return Math.round(t.entrada * p.entrada + t.cache * p.cache + t.saida * p.saida + escrita);
}
