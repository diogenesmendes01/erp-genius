// Preços por milhão de tokens (USD) = micro-USD por token, conforme as Global Constraints do plano.
// Conferido na tabela pública em 18/10/2026 (quadro, "Fase 5, bloco A"): Haiku 5.5 cache 0,01
// confirmado (prompts até 100 mil tokens). Sonnet 5.5 cache público é 0,10; aqui fica 0,20 do plano
// (superestima o gasto, lado seguro do teto) até o dono decidir. Escrita de cache não é cobrada aqui.
export const MODELOS_PERMITIDOS = ["claude-sonnet-5-5", "claude-haiku-5-5"] as const;

interface Preco {
  entrada: number;
  cache: number;
  saida: number;
}

const PRECOS: Record<(typeof MODELOS_PERMITIDOS)[number], Preco> = {
  "claude-sonnet-5-5": { entrada: 2, cache: 0.2, saida: 10 },
  "claude-haiku-5-5": { entrada: 0.1, cache: 0.01, saida: 0.5 },
};

export function custoMicroUsd(modelo: string, t: { entrada: number; cache: number; saida: number }): number {
  if (modelo === "simulado") return 0;
  const p = (PRECOS as Record<string, Preco | undefined>)[modelo];
  if (!p) throw new Error(`Modelo sem preço cadastrado: ${modelo}`);
  return Math.round(t.entrada * p.entrada + t.cache * p.cache + t.saida * p.saida);
}
