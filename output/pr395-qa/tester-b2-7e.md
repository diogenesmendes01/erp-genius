# QA independente #395 — 7e60dc361ac0e1dcac157cc182eef65956f34f05

Parecer favorável ao delta B2 de tooling nesta fonte exata; não encontrei bloqueio alto ou médio. O head remoto `f8b24f8af5f7bc7ec15bbb61f1a84422604d4849` estava disponível localmente e não altera `src`, `scripts`, `package.json` ou `package-lock.json` contra 7e60.

## Identidade do delta

- Checkout TESTER destacado em 7e60, rastreados limpos. Nenhum artefato privado colidiu no checkout.
- Contra `17ab18b7d8046bae4879077234bc588724c8528b`, exatamente seis arquivos mudam em `src/scripts/package/lock`: `package.json`, `package-lock.json`, duas guardas de dependências, uma linha de `scripts/visual/capturar-inbox.mjs` e README visual. Todo o restante de `src` e `scripts`, inclusive app, testes funcionais, servidor, painel e foco, é byteidêntico à fonte já revisada. Checagem chunk `4cdd56`, exit 0.
- Os quatro objetos de tooling `package.json`, `package-lock.json`, `src/test/dependencias.ts` e `src/test/dependencias.test.ts` são byteidênticos ao shared `825653d018b0df9a51eec0bf758fe8d7779eb5bd`. A CLI remove somente o fallback fixo para Chromium Linux: exige `PW_CHROMIUM` explícito; o README documenta isso. `@babel/standalone` permanece 7.29.0.
- `@playwright/test`, `playwright`, `playwright-core` direto e o core aninhado resolvido pelo runner são todos 1.64.1 no worktree próprio (caminhos reais, chunk `2cca51`). A guarda compara as quatro versões e falha em resolução ausente/divergente.

## Execuções próprias

- Node 22 local: Vitest dirigido `src/test/dependencias.test.ts`, `src/test/visual-inbox.test.ts`, `PainelSetor.test.ts`, `PainelContato.interacao.test.ts`, `dialogo.test.ts`, `dialogo.interacao.test.ts` e `dialogos.test.ts`, `--maxWorkers=2`: **7 arquivos/64 testes, exit 0**, chunk `ffc0d7`.
- `node --check scripts/visual/capturar-inbox.mjs`, CLI `--help`, resolução física das quatro dependências e `git diff --check`: **exit 0**, chunk `2cca51`. Nenhuma captura foi iniciada.
- OIDs/diffs e rastreados limpos: chunk `4cdd56`, **exit 0**.

## Limites

Não executei DB, Prisma, browser real, captura, suite global, TSC ou lint. CI 5/5 do outro integrador não é execução minha. Este parecer cobre o código exato 7e60 e a extensão por identidade de arquivos executáveis ao head remoto f8b24; não pressupõe homologação visual nova.
