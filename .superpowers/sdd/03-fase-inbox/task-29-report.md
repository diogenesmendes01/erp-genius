
# Task 29 — Casca da página, vistas no celular e fim do polling

## O que foi feito
- `useEventosInbox.ts`: `EventSource("/api/inbox/eventos")`, reconexão do navegador; ouve os quadros nomeados (`event: <tipo>`) com `addEventListener` (o servidor usa nomes de evento, `onmessage` não os recebe).
- `InboxNovo.tsx`: três colunas por breakpoints Tailwind (`min-[700px]`, `min-[1100px]`), `data-vista` em `lista | conversa | painel` (começa em `conversa` com `?c=`), estado vazio "Escolha uma conversa", lista com "Carregar mais" (cursor), conversa com `useConversa` + `VirtualList` + `BalaoMensagem` + `Compositor` ligado a `enviarTextoInbox`/`enviarMidiaInbox`/`registrarNotaAtendimento`, painel inline (>=1100px) ou em `Drawer` (<1100px). Ao chegar aviso: a thread reconcilia via `useConversa`; a lista busca só a primeira página de `/api/inbox/atendimentos` e troca/insere as linhas afetadas.
- `page.tsx`: guarda antes de qualquer consulta; filtros e cursor da URL (`lerFiltrosInbox`, `decodificarCursor`; cursor inválido é ignorado); `listarAtendimentosPagina`. 
- Testes: `InboxNovo.test.ts`, `sem-polling.test.ts`, `page.test.ts` reescrito.
- Travas globais: `botoes.test.ts` (4 controles de paginação/navegação), `estados-vazios-mapa.ts` (1 entrada).

## Testes
- `tsc --noEmit`: 0 (precisei rodar `node_modules/.bin/prisma generate`: o client gerado do worktree estava defasado em relação ao schema — MOTOR/agendadaPara).
- eslint no inbox + botoes.test.ts: 0.
- `vitest run` completo: 5070 testes, 2 falhas só por timeout de 30s em varreduras da árvore inteira (confirmacoes, contraste) sob carga; ambos passam isolados (76 testes).
- Não rodei integração (a tarefa não toca *.int.test.ts).

## Desvios
1. `sem-polling.test.ts`: o brief manda varrer todo `*.tsx`, mas `InboxCliente.tsx` (setInterval + refresh) e `AtendimentosPainel.tsx` (router.refresh) só saem na Task 33. O teste exclui esses dois (lista LEGADO) e testa o resto, inclusive `.ts`; a Task 33 deve apagar a lista. `globSync` não existe nos tipos do Node instalado: usei `readdirSync(recursive)`.
2. `page.tsx` ainda renderiza `AtendimentosPainel` (abrir atendimento; triagem/revisão só admin) acima da casca nova para não perder função até a Task 33. `InboxCliente` não é mais usado pela página (arquivo mantido até a 33).
3. Painel lateral é um resumo mínimo do contato (o painel por setor é Task 32); cabeçalho/ações da conversa são Task 31; filtros na UI são Task 30 (aqui só vêm da URL).
4. Estado de aviso chama-se `eventoRecente` (a trava feedback-separado trata `aviso` como estado de mensagem).

## Preocupações
- Se `?c=` aponta atendimento fora da primeira página da lista, `atual` é null: a thread carrega (rota com escopo) mas o compositor fica desabilitado com MOTIVO_SEM_ENVIO e o driver é desconhecido. Resolver na Task 31 (buscar o item por id).
- `podeEnviar` é sempre true na UI; a autorização real está nas actions.
- A lista refaz a primeira página a cada aviso do SSE (sem rota por linha); pode ser caro com muito tráfego.
