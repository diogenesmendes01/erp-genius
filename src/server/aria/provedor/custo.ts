// Preços por milhão de tokens (USD) = micro-USD por token. Fonte: tabela oficial da Anthropic
// (https://platform.claude.com/docs/en/about-claude/pricing), consultada em 18/10/2026. Decisão do dono: usar o preço
// oficial (a Global Constraint do plano 05 que dizia "cache 0,20" para o Sonnet 5.5 fica superada).
// - Sonnet 5.5: entrada 2; escrita de cache 2,50 (5 min) / 4 (1 h); leitura de cache 0,10 (0,05× a entrada, nota 2 da
//   página); saída 10. Sem faixa de prompt longo.
// - Haiku 5.5, prompt até 100.000 tokens: entrada 0,10; escrita 0,125 / 0,20; leitura 0,01; saída 0,50.
// - Haiku 5.5, prompt acima de 100.000 tokens: entrada 0,50; escrita 0,625 / 1; leitura 0,05; saída 2,50.
//   O prompt é o total de tokens de entrada da requisição (input + leitura de cache + escrita de cache); acima do limite
//   a chamada inteira paga a faixa alta, em todas as categorias. Ver precoPorMilhao.
// Escrita de cache (cache_creation_input_tokens, fora de input_tokens) = entrada × fatorEscritaCache(ttl).
// inference_geo US-only (1,1× em tudo) não é usado.
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

export interface Preco {
  entrada: number;
  cache: number;
  saida: number;
}

/** Haiku 5.5: prompts de até este total de tokens de entrada pagam a faixa baixa; acima, a faixa alta. */
export const LIMITE_PROMPT_HAIKU_FAIXA_BAIXA = 100_000;

interface Faixas {
  base: Preco;
  /** Preço quando o prompt passa de LIMITE_PROMPT_HAIKU_FAIXA_BAIXA; ausente = sem faixa de prompt longo. */
  promptLongo?: Preco;
}

const PRECOS: Record<ModeloPermitido, Faixas> = {
  "claude-sonnet-5-5": { base: { entrada: 2, cache: 0.1, saida: 10 } },
  "claude-haiku-5-5": {
    base: { entrada: 0.1, cache: 0.01, saida: 0.5 },
    promptLongo: { entrada: 0.5, cache: 0.05, saida: 2.5 },
  },
};

/** Preço por milhão de tokens do modelo para uma requisição com `tokensPrompt` tokens de entrada no total. */
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
