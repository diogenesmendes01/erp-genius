# Inbox #345 — relatório DEV

Sugestões/decisões e mudanças globais da Aria não tinham todos os avisos necessários para atualizar o Inbox aberto. A entrega acrescenta os triggers transacionais e o evento global fechado, recarrega lista/painel e preserva mensagens agrupadas pelo React. As consultas continuam decidindo o acesso e o conteúdo.

Base MAIN coordenada: fabf7addf291de6e4b821927cfc1c88ce93bd9fb; branch codex/inbox-e3-345-tempo-real. Plano privado aprovado: SHA256 4e84387efecbdf67c780f9e6b938a82182838ce58c3837d30d7cb6929586b8cb. A issue é independente da #344; seu cursor e a correção de offsets ficaram no integrador.

## Escopo e preservação

Cinco arquivos produtivos mudaram: tipo em barramento.ts; validação global em eventos-sse.ts; whitelist em lib/eventos-inbox.ts; defesa no historico-conversa.ts; predicado e callback em InboxNovo.tsx. Há uma SQL nova, nove arquivos de testes, esta documentação e o quadro. Nenhum schema/modelo, dependência, permissão, produtor de decisão/executor ou harness visual mudou. Os tipos antigos/resync permanecem no fluxo anterior.

Prova AST 487427/9ea2b7, EXIT0: sete funções da fonte compartilhada e nove do barramento são literais à base (só whitelist/tipo do aviso mudaram). Onze paths protegidos incluem histórico/executor Aria, escopo, estado342, consultas-pagina, rota SSE, wrapper, migration antiga, schema, package e lock, iguais normalizando EOL. A prova é nominal à fase anterior à escrita da SQL; o manifesto final reconfere fonte e namespaces.

Global exige quatro campos próprios/enumeráveis, valores vazios e nenhuma chave inesperada. Rejeita payload, destinatário, símbolos ou campo obrigatório oculto. O evento não substitui eventoRecente, preservando mensagem/resync do mesmo act. Fonte, reconexão, leitura automática e coalescedor atuais permanecem. Os avisos manuais continuam presentes; não se promete dedup universal nem se executa negócio no cliente.

## TDD e negativos nominais

| Execução | Resultado e atribuição |
| --- | --- |
| 57d2a9 | UNIT RED: sete completos/108, 12 falhas causais/96 controles, EXIT1 |
| f5c1cf | Erro administrativo de sintaxe do novo mock React; zero coletados, EXIT1. Corrigido só o mock antes do RED comportamental |
| 71680/989b85 | ReactDOM RED: cinco casos/cinco falhas, EXIT1; global sobrescrevia mensagem/resync e provocava busca indevida da thread |
| 25977/54704f | GREEN inicial: oito completos/113, 14,06 s total, EXIT0 |
| 19692/80a91a | UNIT ampliado anterior: 14 completos/353, 36,17 s total, EXIT0; nominal antes do ajuste de enumeração |
| c1be28 | RED complementar: eventos-sse completo/18, uma falha/17 controles, EXIT1; campo obrigatório não enumerável sumiria no spread |
| 5357d2 | GREEN complementar: eventos-sse/rota completos, 30/30, EXIT0 |

A correção complementar exige também quatro propriedades enumeráveis, sem alterar tipos antigos. Não se somam executores sobrepostos. ReactDOM, useConversa e HistoricoConversa são reais; dados/ações e geometria do DOM são fakes. Não houve HTTP ou navegador real nesses testes.

## RED de banco, revisão e aplicação

ROOT READY b2ce2b confirmou ciint491, cliente próprio 490, 424 hashes/502 registros/snapshot 8d5 preservados e zero outra atividade/LISTEN. Lease exclusiva para barramento.int.test.ts completo, inclusive C5 restrito ao LISTEN do current_database. Nenhum cluster/servidor foi parado.

Teste congelado: 14.185 bytes físicos, SHA256 72c8f842733c17b9cd4cc94ea88615f423366841cf00c4c305206acbd1cfee80. Comando local Node22:

```powershell
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts src/server/inbox/barramento.int.test.ts --maxWorkers=1
```

Sessão 50815/eef889: 26 completos, 13 falhas por avisos novos ausentes/13 controles verdes, 132,60 s de testes/135,98 s total, EXIT1. Não é suíte verde. Passaram os sete legados/C5 e os controles de no-op, NULL, rollback e aviso manual. Nenhum filtro, skip ou ajuste de timeout.

Âncora/turno/setup precedem uma barreira positiva de notificação, para não confundir avisos antigos com o novo trigger. Uma transação retida por deferred prova ausência no checkpoint antes do commit e presença depois; rollback tem barreira posterior. A conexão pg auxiliar não faz LISTEN e fecha em afterAll; subscribers e latch são liberados em finally.

Banco liberado; ROOT c9fcdc confirmou restauro491 com 424 hashes, snapshot 8d5/fixture/dados preservados e zero outra atividade. Só depois foi escrita a SQL reservada. O ID histórico 20261023210000 não foi reutilizado.

Migration: prisma/migrations/20261025020000_inbox_aria_tempo_real/migration.sql, 1.466 bytes LF/sem BOM, SHA256 b7c9f6eb0c411a379e4392b5851b18e6a3ea44b4dd4f11661af7aaa3d358441e. Freeze integral 8502ef; BEGIN/COMMIT, duas funções e dois triggers novos, sem ALTER/REPLACE/DML/backfill ou redefinição da função antiga. DEV não aplicou SQL/migrate/generate.

ROOT aplicou somente essa SQL em cae862 EXIT0: histórico491→492, 424 tabelas, dados originais/histórico491/trigger antigo preservados. Backup 6b8c41 EXIT0: 503 registros/424 hashes; snapshot SHA256 f68811b11edabd292bd9c3d25e3d00159b79d677ea26834e359e19a2dea31e94, schema inbox_snapshot_ciint_b_492_20261025. O novo restaurador ROOT valida três funções/615 triggers. Nenhum restaurador491 foi usado depois. Cliente continua490, sem mudança de modelo.

## Gates finais

| Gate | Executor/terminal | Resultado |
| --- | --- | --- |
| Barramento INT completo | 55837/fa785d | 26/26, 95,83 s testes/98,62 s total, EXIT0 |
| Cinco INT de regressão completos | 46768/4a7dc6 | Cinco arquivos/48 casos, 179,49 s testes/186,12 s total, EXIT0 |
| UNIT relacionado final | 14119/7900e7 | 14 arquivos/354 casos, 35,19 s total, EXIT0 |
| Lint final dos 14 SRC/testes | 5e786f | EXIT0, sem aviso |
| TSC auxiliar qualificado | 3554/52eb7f | EXIT0 |

O primeiro GREEN usou o mesmo comando/arquivo/SQL do RED. O segundo foi OUTRO executor, sem repetir barramento, com eventos-sse.int.test.ts, aria/estado.int.test.ts, aria/pausa.int.test.ts, aria/expiracao.int.test.ts e aria/turno/handoff.int.test.ts. Ambos usam vitest.integration.config.ts/maxWorkers1, perfil isolado, sem filtros ou testes ignorados. São recortes separados, não suíte global.

O corpus real verifica mensagens/atendimento antigos, C5, ação nova e mudanças de status, silêncio em no-op/NULL, quatro campos/sem conteúdo, coalescimento SQL, dois atendimentos, commit retido/rollback, estado/pausa/reativação e convivência manual. As regressões cobrem escopo, estado, pausa, expiração e handoff atuais. Não se mudou produtor/ACL para obter GREEN.

UNIT usa maxWorkers1 e arquivos completos: eventos-sse; eventos-inbox compartilhado; useEventosInbox; historico-conversa; InboxNovo; SeloNaoLidasInbox; rota SSE; InboxNovo.aria-eventos; InboxNovo.foco/interacao/detalhes; atualizar-lista-em-lote; sem-polling; enums-rotulos. Lint cobre os 14 arquivos efetivamente alterados de SRC/testes. Os resultados anteriores não foram reatribuídos ao final.

TSC: Node22/heap8192, --noEmit --incremental false -p tsconfig.inbox-342-aux-private.json. A auxiliar estende a original, preserva seus includes/excludes e acrescenta SOMENTE output/inbox-326-a2-diagnostico-private.test.ts e output/inbox-326-package-r8-7a30d4-preservado-private/inbox-326-a2-diagnostico-private.test.ts além do node_modules original. Todos os SRC/configs/testes atuais estão incluídos. Não se declara TSC original/global neste worktree com privados como verde; checkout limpo/composição/CI pertencem ao ROOT.

## Limites e handoff

Relógio, orçamento/ConfigIA e publicação de versão não disparam esses dois triggers sozinhos. O cron precisa efetivamente mudar status para emitir. Não se criaram timers/triggers extras ou alçadas D1–D4. Root fará a união dos hunks com #328/#344; esta fonte não contém nem testa essa composição futura. Não há prova nova de navegador/layout, integração externa, mensagem real, instalação ou deploy.

Todos os executores DEV terminaram. Lease492 explicitamente liberada ao ROOT após 46768. Constância final ROOT c80ad9, EXIT0, pelo restaurador exclusivo492: 424 tabelas, dados/fixture/snapshot503 e hashes preservados, zero outra atividade; três funções e 615 triggers reconferidos contra o DDL revisado. Histórico/migration492 e snapshot f68811b11edabd292bd9c3d25e3d00159b79d677ea26834e359e19a2dea31e94 mantidos. Nenhuma nova lease DB. QA independente do commit exato, união/CI e publicação continuam pendentes. #345 não é marcada concluída ou homologada só pelos gates DEV.
