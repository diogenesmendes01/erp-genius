# QA estática independente — Inbox #336

Fonte exata: `a96d86455efedb960b60dac198a99eb82238cbdd`; base `4c76d200257ea4c3df3707e95100d9180a9efdbc`. Revisão no worktree exclusivo TESTER, sem alteração de produto, banco, Prisma ou browser. `git diff --check` do intervalo terminou com código 0; rastreados limpos. O diff de código está restrito aos consumidores Funil, Contatos, Tarefas, Aria e ao produtor `src/server/inbox/atalhos.ts`/projeção B2B do painel. Schema, migrations, package e lock não mudaram.

## Parecer de código

Favorável ao checkpoint estático, sem achado alto ou médio nesta fonte. `atendimentoParaAbrir` exige papel Inbox e reaplica `escopoAtendimentos` e contato individual em **todas** as buscas, inclusive ID explícito e fallback encerrado. A prioridade ID explícito → lead aberto → pessoa aberta → encerrado é consistente com a SPEC; o retorno é somente `{ atendimentoId, aberta }`. Convite a A não autoriza B; a capacidade de leitura não concede envio. Funil/Contatos/Tarefas só consultam o atalho depois de obterem o objeto-alvo autorizado. Tarefa nova ou negada não produz o atalho.

No B2B, `atendimentosParaPessoas` usa um escopo para a operação, consulta em lotes de 100, cursor por `(ultimaMensagemEm,id)` inclusive cauda `null`, e percorre até esgotar os candidatos ou resolver os participantes. Não há N+1 por participante nem teto global que esconda pessoa antiga. O mapa é indexado por pessoa, e cada atendimento ainda passa pelo escopo. A projeção do painel ocorre após o atendimento pai autorizado e não herda acesso à conversa de outros participantes. A cobertura de integração contempla 100+ candidatos, convite só A, revogação, leitura sem envio, empate/nulos, grupo, pool 1 e dono trocado; esses casos foram executados depois no recorte independente indicado abaixo.

`hrefConversa` codifica o ID com `encodeURIComponent`; `agendar=1` só aparece quando a conversa está aberta. O consumidor E4 ainda não está implementado neste checkpoint: o link não prova abertura do diálogo, agendamento ou envio. O histórico Aria acrescenta apenas o ID já associado à ação histórica autorizada; a tela Inbox revalida o acesso ao destino. A consulta histórica conserva o recorte por leads/equipe já existente, sem consulta adicional por linha.

## Execução própria e limites

Node 22 local, Vitest em `node_modules/vitest/vitest.mjs`, `--maxWorkers=2`: 9 arquivos / 66 testes, exit 0, chunk `418288`. Arquivos: `atalhos.test.ts` e os testes dirigidos de Historico, FichaContato/page, FunilCliente/PainelOportunidade/page e PainelTarefa/page. Nenhum filtro de nome ou skip novo; isto é recorte, não suíte global. A saída terminal do DEV (33/363 unit, 3/38 integração, TSC/lint 0) permanece evidência **nominal dele**, não minha.

Integração própria realizada após LEASE expresso do ROOT no perfil descartável `integracao`, cliente487. Mesma sessão `9481`, chunk final `edc89b`, exit 0: **3 arquivos completos / 38 testes**, 114,40 s, `--config vitest.integration.config.ts --maxWorkers=1`, sem filtro de nome ou skips novos. Arquivos: `src/server/inbox/atalhos.int.test.ts`, `src/server/aria/consultas.int.test.ts` e `src/server/inbox/painel-detalhes.int.test.ts`. Provedores externos vazios. Banco liberado ao ROOT imediatamente após saída terminal para restauração do snapshot 914. Este resultado é execução independente minha na fonte exata a96d; o resultado 3/38 do DEV é nominal distinto.

Pendências para aceite final: inspeção visual real de Funil/Contatos/Tarefas/Aria/B2B e limiares de layout; regressão global integrada, PR e CI coordenados por ROOT. Não alego homologação de E4.


