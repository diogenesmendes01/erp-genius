# #313 — gates do agregado com leitura automática

Fonte executada: `92faa81c`, composição do freeze DEV `f51c42a27300ae0feae7ccc1c764350fd641da22`
com base `f8d2cc17989be6afb57f8cde29bf516d204259ff` e fonte local #391.
Node 22.23.2, bins locais; sem instalação, mudança de dependências ou banco.

- Vitest global `run --maxWorkers=2`, executor **39018**, saída **0**:
  **877 arquivos / 6.848 testes**, 245,46 s. Sem filtro de arquivos/nomes
  ou testes ignorados reportados. A configuração exclui `*.int.test.ts`;
  esta execução não é suíte completa de integração.
- Next `typegen`: saída **0**, tipos gerados com sucesso.
- TypeScript `--noEmit`, heap 8192, executor **34749**: saída **0**.
- ESLint global, executor **28754**: saída **0**, **0 erros / 42 avisos**.
  Quarenta avisos pertencem às fontes anteriores; dois adicionais vêm de
  variáveis não usadas em uma cópia privada de probe no staging do ZIP #318
  (`output/inbox-318-pacote-156d/tester/output/qa-318-extra-tester.mjs`).
  Não são avisos novos do código publicado da #313. O staging, seus hashes
  e o pacote remoto foram preservados sem alterações para ocultar avisos.

Logs privados: `output/inbox-313-global-{unitarios,typegen,tsc,lint}.log`.
Todos os executores foram acompanhados até a saída terminal; nenhum silêncio
de log foi contado como sucesso. Nenhum processo de teste do integrador ativo
ao registrar este resultado.

Merge documental posterior `18fa1f94` incorpora o freeze DEV `cfd62701`.
Comparação prévia dos executáveis `src/scripts/prisma/package/lock` entre
`92faa81c` e `cfd62701` sem diferenças; a execução acima pertence à mesma
fonte funcional. A correção #388 ainda será composta e verificada à parte,
portanto estes gates não se estendem antecipadamente a esse próximo estado.

TESTER independente no f51: 4 arquivos / 81 testes mais 39 adversariais R6,
ambos com saída 0, sem DB/browser próprios. DEV executou separadamente dois
arquivos / 20 testes de integração no banco descartável dev-gravacoes;
snapshot original restaurado pelo integrador antes do A/B. A/B e evidências
de navegação estão no resumo causal sanitizado, identificados pelas fontes.

Formal APP atual, QA final exata, ZIP remoto e PR individual ainda pendentes.
Não declarar #313 integrada antes de CI, merge e fechamento da issue.
