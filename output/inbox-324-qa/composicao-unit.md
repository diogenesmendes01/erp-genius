# QA independente — composição local #324 em f9c14500976f5a685ad9648e4b8bb7423d7da7c4

Parecer estático/unitário favorável para a composição local, sem homologar a futura base main. O checkout detached e rastreados estavam limpos (`fb5546`, exit 0); o perfil local atual é `integracao`, mas nenhum teste de banco/Prisma/Next foi executado.

A cadeia é `a1a94fff...` → `92bce27d` (produto #324) → `31a675e0` (harness) → `f9c14500` (evidências). Os arquivos centrais de produção #324 são byte iguais ao freeze `2396a6c7`, e os scripts/testes do harness são byte iguais a `ce658d8d`. Contra `8e503a72`, a base acrescenta três JSDoc em `InboxNovo.tsx`, `ListaAtendimentos.tsx` e `prazo-vivo.ts`, remove duas linhas em branco de `ConversaAberta.test.ts`, altera o README visual por deduplicação e incorpora o patch SLA #410 (`alertas-sla.ts` e seu INT). Não há outra diferença em `src/scripts/prisma/package/lock` (`git diff --name-status`, `c61018`); `git diff --check 8e..f9` terminou 0.

Executei no Node 22 local o recorte unitário de `ContatoCabecalho.interacao`, `ContatoSemNome`, `TagsContato`, `PainelContato`, `InboxNovo.interacao`, `paineis-tags` e `visual-inbox-tags`: 7 arquivos, 123 testes, terminal `f4341d` exit 0, `--maxWorkers=2`, sem filtros `-t`/skips. Uma primeira invocação `15d64d` terminou 1 antes de executar testes porque este Vitest não aceita `--minWorkers`; removi apenas a opção, confirmei a ajuda e executei o recorte acima. Não chamo a primeira tentativa de falha de produto.

A identidade de produto/harness foi verificada por lista de diff e inspeção textual; o único delta de `scripts/visual` em relação a `ce658d8d` é README.md, sem alteração dos executáveis da captura. Os gates anteriores de produto/harness/visual permanecem nominais às fontes respectivas, sem reatribuição. Integração #324 de 54 casos, TSC e gates globais na futura composição main ainda dependem do SHA final e da liberação do banco pelo integrador; não usei o banco `integracao` nesta QA.

