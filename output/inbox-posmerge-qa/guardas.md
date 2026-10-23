# QA independente — follow-up B de guardas/portabilidade e Inbox

Fonte exata: `51c2cd9f529dbdce4e6ce30fe262b2551cd86f70` (base `4829a27424c2cf6091f5f7c5ea545a888fc0be06`; commits d7859ab45, 6f0e83a4, 924b0732 e este head). Parecer favorável no escopo testado, sem bloqueio alto ou médio identificado.

## Revisão

- `caminhosRastreados` lê `git ls-files -z`, portanto usa o índice mesmo quando Windows não materializa os dois nomes. A chave `toLowerCase()` compara o caminho completo, inclusive diretórios. O teste adversarial constrói índice Git temporário com `src/Caixa.tsx`/`src/caixa.tsx` e testa nome de diretório; o cleanup checa que o caminho resolvido da fixture tem como pai o diretório temporário resolvido antes de `rmSync`. O índice do projeto não é modificado por essa fixture.
- `.gitattributes` acrescenta LF somente a `/src/**/*.ts`, `/src/**/*.tsx` e `.github/workflows/ci.yml`; a regra LF já existente da CLI visual permanece. `git check-attr eol` confirmou `lf` em TS, TSX, CLI e CI nesta fonte. Não houve renormalização maciça nem alteração de scripts. A guarda de CI continua com normalização defensiva antiga.
- A isenção de cor inválida `ring-offset` saiu de `NAO_E_COR`, com assert que a recusa, enquanto `ring-offset-white` e `ring-offset-2` seguem aceitos. Regex e demais classes não mudaram.
- O único source produtivo alterado é `consultas-inbox.ts`: remove a função compartilhada órfã `contarNaoLidas`; busca em `src`/`scripts` não encontrou chamada remanescente. As duas asserções de linha comercial agora usam a API pessoal real `contarConversasNaoLidas` e preservam expectativas 0/1. Hook `useEventosInbox`, singleton `eventos-inbox`, Selo, schema/migrações, package/lock e scripts são byteiguais à base (`git diff --quiet`, exit 0). O novo teste ReactDOM cobre dois assinantes/uma fonte, callback atualizado sem reinscrição, StrictMode, desmontagem, callback antigo e ausência de EventSource; não é simulação de backend real.

## Execuções próprias

- Node 22.23.2/Vitest local, oito arquivos completos de caminhos/paleta/ci-workflow/hook/SSE/Selo, `--maxWorkers=2`, sem filtro de nome/skips novos: chunk terminal `db7491`, **8 arquivos/65 testes, exit 0**.
- Banco descartável exclusivo `.erp-test-profile=tester`, schema/cliente 487 preparados pelo integrador, transportes externos vazios; `vitest.integration.config.ts`, `--maxWorkers=1 --no-file-parallelism`, arquivo completo `src/server/whatsapp/linha-comercial.int.test.ts`: sessão executor **54095**, chunk inicial `d38c36`, terminal `251818`, **1 arquivo/24 testes, exit 0**, 71,38 s. Banco liberado ao ROOT imediatamente após a saída terminal para restauração; não o restaurei.
- `git diff --check` de `src`/`.gitattributes` terminou 0. HEAD exato confirmado e rastreados limpos.

Não executei suíte global, TSC, lint, browser, Prisma, CI ou outros arquivos INT. Os 11 arquivos/367 unitários e demais gates DEV/ROOT são evidências externas, não minhas. O teste ReactDOM usa EventSource falsa sem rede; não afirma uma conexão real de navegador. A integração 24/24 cobre linha comercial e contagem pessoal nos casos existentes, não substitui a suíte completa de não lidas. O warning MIXED_EXPORTS da configuração de integração foi observado sem alterar tooling.
