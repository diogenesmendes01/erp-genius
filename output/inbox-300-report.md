# Relatório DEV B — #300

Estado final em 22/10/2026: **contrato de servidor/SSE implementado e validado; PR em publicação**. Branch `codex/inbox-e0-300`, base #299/PR #382 (`729a0fe7`). TESTER aprovou a fonte `288c62e1` e o delta documental `9853be83`, com integração independente de 3 arquivos/45 testes, sessão `37125`, saída 0 e sem ignorados, Node 22.23.2 no perfil tester. Parecer em `output/inbox-300-review.md`. Consolidação posterior contém somente documentação. Sem merge/deploy; apresentação das notas na tela pertence à #301.
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

Recorte pós-refatoração: `nota-interna.int.test.ts` e `consultas-pagina.int.test.ts`, 2 arquivos / 26 testes, sessão `10696`, saída 0; `inbox.int.test.ts`, 1 arquivo / 19 testes, sessão `27335`, saída 0. Ambos no Node 22.23.2 e banco `dev-gravacoes`, nenhum ignorado. ESLint dos 7 TypeScript tocados com `--max-warnings 0` saiu 0. A apresentação das notas na UI fica na #301.

TSC global com heap 8192 no Node 22.23.2 inicialmente saiu 1 por inferência implícita de `any[]` no teste novo; após declarar `{ id: string }[]`, repetição com saída 0.

Gates globais no SHA de código `288c62e1` (Node 22.23.2): TSC `--noEmit` com heap 8192 saída 0; Vitest completo sem filtro `--maxWorkers=2`, 840 arquivos / 6.478 testes, sessão `47978` até saída 0, nenhum ignorado; ESLint global `.` com `--max-warnings 40`, sessão `61365` até saída 0, 0 erros / 40 avisos herdados. Revisão TESTER e homologação seguem pendentes.

### PR #386 — revisão C1/C2: notas da Aria em tempo real — 2026-10-22

**Estado: correção e gates locais concluídos; revisão independente, integração da base e CI/retarget pendentes.**

- C2 reproduzido em PostgreSQL real: criação da nota pelo executor e arquivamento por desfazer não notificavam. RED77015 exit1:2falhas/1pass,49ignorados pelo filtro; o handoff já passava pelo trigger de atendimento. Emissão explícita transacional apenas nos dois caminhos faltantes, com tipo/ids e sem conteúdo; handoff não recebe aviso duplicado. Sugestão/SHADOW/rollback não notificam nem persistem nota. Sem papel/permissão/schema/transportes novos.
- Helper de integração usa LISTEN real e canal privado de barreira para provar entrega/ausência após commit, sem sleeps nem aviso falso no canal do Inbox. URL local validada na lista fechada. Import inicial fora de src fez a guarda confirmacoes falhar; global70197 foi interrompido exit1. Corrigido sem abrir exceção:confirmacoes5415 GREEN59/59 e novo global completo abaixo.
- C1 evidências locais no perfil exclusivo ci-integracao:92375 exit0,4arquivos/75testes (consultas-pagina,executor-crm,handoff,historico), e93492 exit0,2arquivos/25testes (nota-interna,inbox), sem filtro/ignorados nesses6arquivos. Não é suíte de integração completa. O pedido de rodar no head final após retarget para main permanece pendente; não atribuir este recorte a um futuro head integrado.
- Gates finais Node22.23.2:unitários12136 exit0,840arquivos/6485testes sem filtro/ignorados;TSC70245 exit0;lintglobal78342 exit0,0erros/40avisos herdados. Base382correções183c incorporada pelo merge localbb543667. Ainda sem merge/deploy destaPR; nenhum envio externo.
- Registro da dependência:PR381 já merged por squash emea60a8a7,comCI39878884253success eTESTER9e5favorável;64PNGarquivados com roundtrip/hash confirmado no draft autorizado. Incorporar correção381/main antes de retarget das filhas para não reintroduzir imagens.
