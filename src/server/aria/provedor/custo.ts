// Preços por milhão de tokens (USD) = micro-USD por token, conforme as Global Constraints do plano.
// Conferido na tabela pública em 18/10/2026 (quadro, "Fase 5, bloco A"): Haiku 5.5 cache 0,01
// confirmado (prompts até 100 mil tokens). Sonnet 5.5 cache público é 0,10; aqui fica 0,20 do plano
// (superestima o gasto, lado seguro do teto) até o dono decidir. Escrita de cache (cache_creation_input_tokens,
// fora de input_tokens) é cobrada a 1,25× a entrada no cache efêmero de 5 min (Sonnet 5.5 2,50; Haiku 5.5 0,125)
// e a 2× com ttl "1h" (Sonnet 5.5 4; Haiku 5.5 0,20). Ver fatorEscritaCache.
export const MODELOS_PERMITIDOS = ["claude-sonnet-5-5", "claude-haiku-5-5"] as const;

export type ModeloPermitido = (typeof MODELOS_PERMITIDOS)[number];

export function modeloPermitido(modelo: string): modelo is ModeloPermitido {
  return (MODELOS_PERMITIDOS as readonly string[]).includes(modelo);
}

export type TtlCache = "5m" | "1h";

/**
 * `cache_control` do bloco de sistema (provedor/anthropic.ts). Sem `ttl` é o cache efêmero de 5 min. Fonte única:
 * o fator de escrita de cache sai daqui, então trocar para `ttl: "1h"` muda o custo junto.
 */
export const CACHE_CONTROL_SISTEMA: { readonly type: "ephemeral"; readonly ttl?: TtlCache } = Object.freeze({
  type: "ephemeral",
});

/** Multiplicador da entrada na escrita de cache: 1,25× no efêmero de 5 min (sem ttl ou "5m"); 2× com ttl "1h". */
export function fatorEscritaCache(ttl: TtlCache | undefined): number {
  return ttl === "1h" ? 2 : 1.25;
}

const FATOR_ESCRITA_CACHE = fatorEscritaCache(CACHE_CONTROL_SISTEMA.ttl);

interface Preco {
  entrada: number;
  cache: number;
  saida: number;
}

const PRECOS: Record<ModeloPermitido, Preco> = {
  "claude-sonnet-5-5": { entrada: 2, cache: 0.2, saida: 10 },
  "claude-haiku-5-5": { entrada: 0.1, cache: 0.01, saida: 0.5 },
};

export function custoMicroUsd(
  modelo: string,
  t: { entrada: number; cache: number; saida: number; escritaCache?: number },
): number {
  if (modelo === "simulado") return 0;
  const p = (PRECOS as Record<string, Preco | undefined>)[modelo];
  if (!p) throw new Error(`Modelo sem preço cadastrado: ${modelo}`);
  const escrita = (t.escritaCache ?? 0) * p.entrada * FATOR_ESCRITA_CACHE;
  return Math.round(t.entrada * p.entrada + t.cache * p.cache + t.saida * p.saida + escrita);
}
