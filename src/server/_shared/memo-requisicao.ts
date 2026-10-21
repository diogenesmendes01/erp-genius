import * as React from "react";

// Memo POR REQUISIÇÃO (ganho rápido 15, docs/42-auditoria-frontend-ux.md): o layout, a página e cada
// consulta pedem o mesmo usuário fresco — em /financeiro eram ~12 leituras da mesma linha por render.
//
// `cache` vem do React embutido no Next para o código do App Router (o `react` 18.3 do node_modules
// não o exporta — por isso um comentário antigo dizia que não dava; `pipeline/page.tsx` e o layout de
// /matriculas/[id] já o usam). Fora de uma renderização de Server Component (Server Action, rota de
// API) e no Vitest, `cache` não memoriza ou nem existe: a função roda a cada chamada, exatamente
// como antes. A frescura não muda — o memo vive só dentro de uma requisição.

/** Lê `React.cache` sem quebrar: no Vitest um `vi.mock("react")` sem `cache` LANÇA ao acessar a chave. */
function cacheDoReact(): (<F extends (...args: never[]) => unknown>(f: F) => F) | undefined {
  try {
    const c = (React as { cache?: unknown }).cache;
    return typeof c === "function" ? (c as <F extends (...args: never[]) => unknown>(f: F) => F) : undefined;
  } catch {
    return undefined;
  }
}

const cache = cacheDoReact();

export const memoPorRequisicao: <F extends (...args: never[]) => unknown>(f: F) => F = cache ?? ((f) => f);

/**
 * Congela em profundidade o que sai do memo: o MESMO objeto (usuário, papéis, escopo) é entregue a
 * todos os chamadores da requisição. Hoje ninguém o altera; congelado, uma alteração futura falha na
 * hora (TypeError em modo estrito) em vez de vazar entre consultas da mesma requisição.
 */
export function congelar<T>(valor: T): T {
  if (valor && typeof valor === "object" && !Object.isFrozen(valor)) {
    Object.freeze(valor);
    for (const v of Object.values(valor as Record<string, unknown>)) congelar(v);
  }
  return valor;
}
