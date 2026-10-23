# TESTER — revisão independente #310

Fonte exata `67014764f664a6602f9f6b2992e5594d3ad775cc` sobre E0 `bcc3d27ab007231a08cabe2c3cf9c9b46a151558`, no worktree `inbox-tester`. **Parecer favorável de código, consulta real e API; visual dos consumidores é da #313.** `git diff --check` saiu 0. Não há schema, migração, pacote, envio ou servidor novo.

## Verificação independente

- Node 22.23.2, recorte unitário de `opcoes-filtro`, `filtros`, rota `/api/inbox/atendimentos`, página SSR, `InboxNovo` e suas interações: **6 arquivos/86 testes, exit 0**. Nenhum filtro de nome ou ignorado informado.
- `.erp-test-profile` confirmou `tester`. Integração isolada no banco descartável liberado pelo integrador, `vitest.integration.config.ts`, `consultas-pagina.int.test.ts` + `opcoes-filtro.int.test.ts`, `--maxWorkers=1`: sessão `78316` acompanhada até **exit 0, 2 arquivos/26 testes**, sem suíte concorrente no perfil. A suíte trunca o banco tester; a fixture visual #307 já havia sido concluída. Não repeti a full global, reservada ao integrador na combinação #309+#310.

## Contrato observado

`contarChipsInbox` usa `escopoAtendimentos` como base e remove apenas filtros controlados por chips (`responsavel`, `naoLidas`, `prazoEstourado`); mantém setor, número, status e busca. Conta linhas do conjunto inteiro, independente dos 50 itens de página. As cinco consultas aplicam condições para todas/minhas/não lidas pessoais/prazo/fila. A condição pessoal existente cruza preferências do usuário e a base autorizada restringe os IDs; o recorte real inclui outro usuário, mais de uma página e convites com/sem envio. A opção `{ enviar: true }` entra no mesmo escopo da lista, sem ampliar visibilidade ou permitir número inativo/atendimento encerrado.

`GET /api/inbox/atendimentos` preserva guarda 401/403, cursor inválido 400 e `no-store`. Apenas `contagens=1` sem cursor adiciona `contagens`; paginação/ausência da flag conservam o JSON anterior. SSR consulta após a guarda e antes de inserir deep link autorizado na lista; esse deep link não aumenta o agregado. No cliente, a primeira página solicita os agregados, a paginação não, filtros invalidam respostas anteriores e a leitura otimista não substitui agregado servidor por zero de linha. O resultado da leitura agenda reconciliação pontual. Os testes dirigidos cobrem SSE, leitura diferida e troca de filtros; não há polling novo.

`opcoesFiltroInbox` mantém seleção por papel/setor e projeta apenas `{ id, rotulo, saude }` para cada número. `ativo=false` prevalece como desconectado; META_CLOUD ativo é conectado; MOTOR/BAILEYS usam a sessão para conectado/instável/desconectado. `SIMULADO` não pertence ao enum atual e não foi inventado. A saúde é apresentação, não uma autorização de envio. A #310 entrega produtores de dados; chips e seletor visual serão validados na #313, sem homologação presumida nesta revisão.
