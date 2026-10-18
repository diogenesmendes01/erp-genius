// Preços por milhão de tokens (USD) = micro-USD por token, conforme as Global Constraints do plano.
// Conferido na tabela pública em 18/10/2026 (quadro, "Fase 5, bloco A"): Haiku 5.5 cache 0,01
// confirmado (prompts até 100 mil tokens). Sonnet 5.5 cache público é 0,10; aqui fica 0,20 do plano
// (superestima o gasto, lado seguro do teto) até o dono decidir. Escrita de cache (cache_creation_input_tokens,
// fora de input_tokens) é cobrada a 1,25× a entrada: Sonnet 5.5 2,50; Haiku 5.5 0,125.
export const MODELOS_PERMITIDOS = ["claude-sonnet-5-5", "claude-haiku-5-5"] as const;

export type ModeloPermitido = (typeof MODELOS_PERMITIDOS)[number];

export function modeloPermitido(modelo: string): modelo is ModeloPermitido {
  return (MODELOS_PERMITIDOS as readonly string[]).includes(modelo);
}

const FATOR_ESCRITA_CACHE = 1.25;

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
