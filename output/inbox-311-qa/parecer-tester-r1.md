# Re-review TESTER #311 R1 e prontidão visual — 1f1bc8864edd9995d9c3ccaf276b1b2e739cde83

O commit integrado contém correção R1 do selo (origem `83c6ec36`) e fix do harness (`abcaaabe4c6eafcfc553f2bb255cdb763eee7631`), sem modificação produtiva da #308. Parecer favorável para estes dois deltas; #311 completa continua aguardando R2 da resposta obsoleta.

R1 usa `total === 1` para texto acessível singular e mantém plural em2/99+, 99+ visível e zero sem selo. Corrige exatamente o `1 conversas não lidas` observado no browser, sem alterar store, SSE ou contagem. Teste SSR cobre1/2/120/0. O helper visual passa a esperar `[data-conectado="1"]` depois do conteúdo real da fixture e antes da screenshot; a assinatura cliente confirma hidratação. A ausência de conexão rejeita a captura; warnings de React continuam coletados e não foram filtrados. O probe negativo do TESTER no SHA anterior reproduziu warning1/5 com screenshot antes da conexão e0/5 depois da conexão; o fix age na causa da corrida com `caret-color:transparent` temporário do Playwright.

Recorte independente Node22 no worktree tester, sem DB/servidor: 5 arquivos/32 testes (Selo, store, SSE, API e harness visual) exit0; navegação Sidebar/BarraMobile 4 arquivos/20 testes exit0. Nenhum teste ignorado. O banco tester segue preparado para a próxima rodada visual no novo SHA.
