# QA independente documental — PR #408

Fonte exata: `45ddad57081e74c6d68ed8f91d9078ce7fd9007b` (pai `ddf9a9bd51eb6fd54abd2a6e64381a229a25190b`). Parecer favorável ao **delta documental**, sem homologar a composição final nem a integração.

## Evidência própria

- `git rev-parse HEAD` confirmou o SHA; rastreados limpos. `git diff --stat` mostrou somente 3 arquivos Markdown e 121 linhas acrescentadas. `git diff --quiet` em `src`, `scripts`, `prisma`, `package.json`, `package-lock.json` e `.github` terminou 0; `git diff --check` terminou 0.
- A SPEC vincula os critérios C1–C4 a quatro arquivos de integração existentes: `src/server/crm/tarefa-atendimento.int.test.ts`, `src/server/aria/turno/executor-crm.int.test.ts`, `src/server/crm/criar-tarefa-idempotencia.int.test.ts` e `src/server/crm/tarefas.int.test.ts`. Conferi os nomes e os casos relevantes no conteúdo versionado. Os relatórios `output/inbox-322-report.md` e `output/inbox-322-integracao-final.md` existem neste checkout.
- As migrações versionadas declaram `Tarefa.atendimentoId` como `TEXT` anulável, FK com `ON DELETE RESTRICT ON UPDATE CASCADE` e índice composto em `(atendimentoId, status)` criado com `CREATE INDEX CONCURRENTLY IF NOT EXISTS`. O texto da SPEC não substitui a verificação do estado efetivo do índice no banco.
- A referência ao plano `docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md` é identificada no documento como consulta ao checkout ROOT; esse arquivo não pertence à árvore deste candidato. Não a tratei como link local presente.

## Limites e gates pendentes

Nenhum teste, Prisma, migração, browser ou banco foi executado nesta QA exclusivamente documental. Os 62 casos de integração e demais gates citados são evidência nominal anterior, não execução minha neste SHA. C1 ainda exige as quatro suítes completas após composição final, schema/cliente compatíveis, estado da FK/índice e snapshot; C2 exige CI do head final. A composição de `ItemEstadoCabecalho` e os conflitos de C3–C4 continuam condicionados ao candidato integrado. Não encontrei bloqueio alto ou médio introduzido pelas três alterações documentais.
