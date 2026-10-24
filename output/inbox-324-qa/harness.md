# QA independente — incremento do harness visual #324

Fonte exata `ce658d8db49bca9a3f050072de2ef3e17c9cbe06`, pai de produto `2396a6c7703d0717a523d93f51a210a75f588135`. Worktree TESTER em HEAD detached, rastreados limpos. Parecer favorável ao preparo do harness, sem achado alto/médio estático ou nos testes puros. Esta não é QA visual final.

O delta de 13 paths altera somente scripts/declarações/testes/documentação do harness; produção em `src/app/(app)/inbox`, `src/server`, `src/components`, schema e package/lock é byte idêntica ao pai. `git diff --check` terminou0. A matriz pura calculada do `ESTADOS` deu 176 entradas (106 APP/70 protótipo), contra164 antigas: só `painel-sem-nome` acrescenta12. O recorte formal dos dois estados da #324 soma24 combinações, sem retirar os outros estados.

`abrirApp` só aceita um ID sem nome vindo da demo/override explícito, valida GET200 real do painel com `cabecalho.semNome=true` e `acoes.podeEditarNome=true` antes de navegar, e então espera hidratação, formulário visível/habilitado e painel único. Não fabrica JSON/DOM nem depende de mensagem canônica ausente. A prontidão de Mariana agora reconhece o texto da tag ✦ separado do × e exige `+ tag`/remover habilitados. O fluxo não dispara Salvar, criação ou remoção de tag. O protótipo usa o HTML histórico `Inbox.dc.html?c=c9`, cujo SHA256 físico conferido é `7698A34BAD041C95F45710CFE3ED6F79A97BA5F49BF5D941751C37324233D8CF`. Busca em `docs/planejamento/inbox-prototipo` encontrou apenas o HTML para `painel-sem-nome`; o PNG pré-exportado alegado em plano não existe e o harness não o inventa. A promessa textual de Aria nesse HTML é referência histórica, não comportamento homologado da aplicação.

Execuções próprias, Node22/local:

- Chunk `a12915`, terminal **exit0**: quatro arquivos `visual-inbox-{tags,cabecalho,coluna,painel}.test.ts`, **23 testes**; recorte puro com mocks de navegação/semântica, não Chrome/ERP.
- Chunk `d7f1d1`, terminal **exit0**: `node --check` de `capturar-inbox.mjs`, `espera-app.mjs` e `nucleo-captura.mjs`, `git diff --check`, identidade dos paths produtivos e HEAD/rastreados limpos.
- Chunk `a54bd9`, terminal **exit0**: `capturar-inbox.mjs --help` lista o novo estado sem iniciar navegador; inspeção `rg --files` da referência HTML.
- Chunk `a41c5e`, terminal **exit0**: contagem direta da matriz pura `total176/app106/proto70/antigas164/novas12`.

O banco/cliente TESTER estão no schema490 da #337, enquanto a fonte de produto #324 é487. Não executei integração, Prisma, Next, browser ou preview. A captura formal de24 imagens, comparação visual, altura500, foco/teclado e fixture real sem nome pertencem à rodada visual do DEV/integração futura; não são aprovadas por estes testes puros. Resultados de TSC/lint e capturas do DEV citados em sua SPEC não foram executados por mim.
