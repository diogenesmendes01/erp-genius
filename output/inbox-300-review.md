# #300 — revisão independente TESTER

**Parecer favorável para o contrato de servidor/SSE da issue #300.** Revisado SHA de código `288c62e199f497b956c4361ed61aab397531aee2` sobre #299 publicada `729a0fe7`; `git diff --check` exit 0. O SHA documental posterior `9853be8356f6a31664224d5b9b332ce108bcac06` só altera quadro/relatório: `git diff --exit-code 288c62e1 9853be83 -- src` exit 0. O delta `2588650b` → `288c62e1` corrige apenas tipagem `{ id: string }[]` no teste e documentação.

## Contrato e fronteiras

- `notasInternasDoAtendimento` fica em `notas-consulta.ts`, fora de módulo `"use server"`; seus únicos chamadores atuais são a rota paginada, depois de `escopoAtendimentos`, e a action pública `notasDoAtendimento`, depois de `atendimentoVisivel`. O helper sem escopo não é exposto como Server Action.
- A página inicial e `depois` retornam notas do atendimento; as de oportunidade são acrescentadas somente quando `podeVerLeadNaThread` autoriza separadamente. `antes` com cursor válido retorna `notas: null` para preservar o estado do cliente. `origem` distingue as duas fontes e a mescla ordena por `(criadoEm,id)` crescente.
- A consulta do atendimento seleciona primeiro as 50 notas recentes com desempate por id; depois retira as arquivadas, sem repor por registros antigos. A action pública conserva a validação de sessão/escopo. Nenhuma nota é criada como mensagem ou intenção.
- `registrarNotaAtendimento` grava `Evento NotaInterna` e `avisarAtendimentoAtualizado` na mesma transação. O aviso `atendimento.atualizado` contém apenas `atendimentoId`, `conversaId` e `mensagemId:null`; não carrega texto nem `paraUsuarioId`. O ramo de repetição idempotente retorna antes da gravação e do NOTIFY.

## Verificação

No worktree exclusivo TESTER, Node **22.23.2**, perfil descartável `tester`, rodei `vitest.integration.config.ts` nos três arquivos exigidos: `src/server/whatsapp/nota-interna.int.test.ts`, `src/server/inbox/consultas-pagina.int.test.ts` e `src/server/whatsapp/inbox.int.test.ts`. **3 arquivos/45 testes, exit 0**, sessão `37125`, duração 187,69 s, sem filtro por nome/ignorados; `fileParallelism:false` garante uma suite por vez no banco. Não executei suíte global adicional. O DEV reportou TSC global exit 0, unitários completos 840 arquivos/6.478 testes exit 0 e lint global exit 0 com 40 avisos preexistentes no SHA de código; os documentos finais preservam essas evidências.

Não há aceite visual de notas nesta issue: o consumo/apresentação na thread e a captura de duas sessões são escopo da #301. Nenhum transporte externo foi ativado.
