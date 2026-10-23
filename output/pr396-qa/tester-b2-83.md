# QA independente #396 — 83f5947d79703ec1d7f4638680c5583c5e17ebc9

Parecer favorável ao delta B2 de tooling nesta fonte exata. Não encontrei bloqueio alto ou médio.

## Identidade

- Checkout TESTER destacado no SHA acima, sem colisões de artefatos privados e com arquivos rastreados limpos.
- Contra `aa42ebb5739bb8dc237541b89e802f6a7f6801da`, o delta em `src/scripts/package/lock` contém somente seis arquivos: `package.json`, `package-lock.json`, duas guardas `src/test/dependencias*`, uma expressão em `scripts/visual/capturar-inbox.mjs` e o README visual. Todo outro `src`, inclusive app, servidor, SSE, C6, selo, hook, testes funcionais e backend, é byteidêntico; idem outros scripts.
- Os quatro objetos de package/lock/guardas são byteidênticos ao shared `f8b24f8af5f7bc7ec15bbb61f1a84422604d4849`. A CLI exige `PW_CHROMIUM` explícito e remove o fallback fixo Linux, sem alterar a execução de captura. Comparação de OIDs/diffs e limpeza: chunk `bdf174`, exit 0.
- Resolução real no worktree: `@playwright/test`, `playwright`, `playwright-core` direto e core aninhado do runner, todos 1.64.1.

## Execução própria

- Node 22 local, `--maxWorkers=2`: `eventos-inbox.test.ts`, `useEventosInbox.test.ts`, os dois `SeloNaoLidasInbox`, `sem-polling.test.ts`, `dependencias.test.ts`, `visual-inbox.test.ts`, rota de não lidas e `InboxNovo.test.ts`: **9 arquivos/79 testes, exit 0**, chunk `5de06e`. Sem filtros internos ou skips.
- `node --check` e `--help` da CLI, resolução física das versões, `git diff --check` e status rastreado: **exit 0**, chunk `236822`.

## Limites

Não executei DB, Prisma, navegador, captura visual, integração, suite global, TypeScript ou lint. Os gates do outro integrador pertencem à fonte/execuções dele e não são atribuídos a este parecer. A PR remota #396 ainda não estava publicada no momento da revisão; este aceite é somente do commit exato acima.
