# #317 — integração do fix C2 da busca

Produto #317 a86c9ade, harness bf4ad547, publicação77575583 e fix funcional
isolado #402 7a82506297cdbb38f9146fd4d6528a6f49c4e44e. Não inclui estados #319.
Conflito somente no quadro, preservando os dois registros. Hook/teste C2 intactos.

Gate do autor do C2, atribuído ao outro chat: global final893arquivos/6977testes,
sessão30869 exit0; TSC39739 e lintglobal3582 exit0,40avisos herdados. TESTER
independente próprio7/37 exit0, favorável; parecer copiado em
output/inbox-402-c2-static-review-tester.md. Browser do autor foi componente
isolado, sem Next/API/SSE/DB: não é prova integrada do ERP.

ROOT executou recorte10arquivos/173testes (a18105 exit0), sem filtro de nome ou
skips,maxWorkers2. O comando incluiu um caminho inexistente
VirtualList.interacao.test.ts, que não foi executado nem contado. Conferida a
lista real por rg: executado VirtualList.estavel.test.ts separadamente,
c62554 exit0,1arquivo/4testes. Total efetivo dirigido11arquivos/177testes.
Diff-check daccfd exit0. Não é global ROOT, banco ou browser.

Próximos gates: regressão global da #317 composta, DEV24PNG formais/8contextos
extras, QA independente em navegador e complemento C2 real com paginação/SSE.
Conferir achado visível após ajuste programático da VirtualList e preservar
rolagem manual/foco. Nenhum envio ou alteração de domínio pelos probes.
