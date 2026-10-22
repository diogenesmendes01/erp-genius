# Relatório DEV B — #300

Estado em 22/10/2026: implementação em revisão, homologação pendente. Branch `codex/inbox-e0-300`, banco descartável isolado `dev-gravacoes`. SHA final será informado ao integrador após os gates.
Rebase de `aa91a47f` para a base publicada #299 `729a0fe7` sem conflito; a diferença entre essas bases em `src` é vazia e o delta empilhado contém só #300.

## Entrega

- `NotaInternaThread.origem` identifica atendimento ou oportunidade. `listarMensagensPagina` devolve notas combinadas na carga inicial e em `depois`, em ordem `(criadoEm,id)`; em `antes`, `notas: null`.
- Notas de atendimento seguem o escopo do atendimento; notas do lead só entram com autorização própria. A ação pública mantém sua verificação de escopo, e a consulta interna está fora do arquivo `"use server"` para não expor um acesso sem escopo como Server Action.
- A criação de nota emite `atendimento.atualizado` com apenas ids, via `pg_notify` na transação da nota. Repetição idempotente não emite outro aviso. As 50 notas recentes do atendimento são selecionadas com desempate por id, antes do filtro das arquivadas.
- SPEC em `docs/specs/inbox-notas-thread.md` e evidências no quadro único. Sem schema, migration, package/lock, instalação ou envio externo.

## Evidência atual

- RED de integração: 2 arquivos, 4 falhas funcionais esperadas e 22 testes verdes, sessão `23893`, saída 1.
- GREEN de integração antes de mover a consulta interna: `nota-interna.int.test.ts`, `consultas-pagina.int.test.ts`, `inbox.int.test.ts`: 3 arquivos / 45 testes, sessão `3068`, saída 0, Node 22.23.2, nenhum ignorado.
- Regressão dirigida antes de mover a consulta interna: `src/server/inbox`, `acoes-atendimento-pool.int.test.ts`, `inbox-idempotencia.int.test.ts`, `aria/historico.int.test.ts`: 10 arquivos / 115 testes, sessão `46885`, saída 0, 562 s, Node 22.23.2, nenhum ignorado. Não é suíte completa.

## Pendências

Recorte pós-refatoração: `nota-interna.int.test.ts` e `consultas-pagina.int.test.ts`, 2 arquivos / 26 testes, sessão `10696`, saída 0; `inbox.int.test.ts`, 1 arquivo / 19 testes, sessão `27335`, saída 0. Ambos no Node 22.23.2 e banco `dev-gravacoes`, nenhum ignorado. ESLint dos 7 TypeScript tocados com `--max-warnings 0` saiu 0. Ainda pendem revisão TESTER, Vitest completo, lint global e homologação. A apresentação das notas na UI fica na #301.

TSC global com heap 8192 no Node 22.23.2 inicialmente saiu 1 por inferência implícita de `any[]` no teste novo; após declarar `{ id: string }[]`, repetição com saída 0. Vitest completo, lint global, review e homologação ainda pendem.
