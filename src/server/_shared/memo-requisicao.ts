import { cache } from "react";

// Memo POR REQUISIÇÃO (ganho rápido 15, docs/42-auditoria-frontend-ux.md): o layout, a página e cada
// consulta pedem o mesmo usuário fresco — em /financeiro eram ~12 leituras da mesma linha por render.
//
// `cache` vem do React embutido no Next para o código do App Router (o `react` 18.3 do node_modules
// não o exporta — por isso um comentário antigo dizia que não dava; `pipeline/page.tsx` e o layout de
// /matriculas/[id] já o usam). Fora de uma renderização de Server Component (Server Action, rota de
// API) e no Vitest, `cache` não memoriza ou nem existe: a função roda a cada chamada, exatamente
// como antes. A frescura não muda — o memo vive só dentro de uma requisição.
export const memoPorRequisicao: <F extends (...args: never[]) => unknown>(f: F) => F =
  typeof cache === "function" ? cache : (f) => f;
