# QA independente final #345 — 2cd984b7

Fonte exata **2cd984b773e576886e878642650e17a25e04c3a5**, base main fabf7addf291de6e4b821927cfc1c88ce93bd9fb. Parecer favorável ao contrato e ao recorte executado: não identifiquei bloqueador novo. UNIT pertinente, lint e as duas fases de integração independentes terminaram com código 0. Este parecer não declara aprovação de global, TypeScript original, CI ou de uma composição futura com #328/#344.

## Fonte, ambiente e gates próprios

Worktree exclusivo TESTER, HEAD detached no SHA acima, tracked limpo reconfirmado em 5cccb0 após os dois terminais. Relatórios privados preservados, sem alterar fonte, SQL, timeout, guardas ou pinos. Perfil tester e cliente490 próprio 647c2586589198b10c9345265e0cce7a43819d5cb44633dbad5e0e0b611fae2b. Node22 local C:/Users/Mendes/AppData/Local/hermes/node/node.exe; executáveis instalados em node_modules.

| Gate próprio | Sessão / terminal | Resultado |
|---|---|---|
| UNIT pertinente, arquivos completos, w1 | 95270 / c75407 | EXIT0; 14 arquivos, 354 testes; 104,10s |
| ESLint dos 14 paths SRC alterados, max-warnings0 | 59992 / c1a114 | EXIT0; nenhum erro/aviso |
| INT fase1, barramento completo, w1 | 46336 / b24a65 | EXIT0; 1 arquivo, 26 testes; 105,23s |
| INT fase2, cinco arquivos completos, w1 | 90341 / f06ed8 | EXIT0; 5 arquivos, 48 testes; 194,83s |

São execuções distintas; não somo recortes a uma suíte global. Não houve -t, exclusão de casos, skips internos ou mudança de timeout. A fase2 só começou após o terminal0 da fase1. Acompanhei cada session_id até o término. Avisos de configuração mixed exports e vite-tsconfig-paths foram mantidos nos logs e não tratados como falha de teste.

O comando UNIT foi Node + node_modules/vitest/vitest.mjs run, seguido dos 14 paths completos e --maxWorkers=1:

~~~text
src/server/inbox/eventos-sse.test.ts
src/lib/eventos-inbox.test.ts
src/app/(app)/inbox/useEventosInbox.test.ts
src/components/conversa/historico-conversa.test.ts
src/app/(app)/inbox/InboxNovo.test.ts
src/components/SeloNaoLidasInbox.test.ts
src/app/api/inbox/eventos/route.test.ts
src/app/(app)/inbox/InboxNovo.aria-eventos.test.ts
src/app/(app)/inbox/InboxNovo.foco.test.ts
src/app/(app)/inbox/InboxNovo.interacao.test.ts
src/app/(app)/inbox/InboxNovo.detalhes.test.ts
src/app/(app)/inbox/atualizar-lista-em-lote.test.ts
src/app/(app)/inbox/sem-polling.test.ts
src/app/enums-rotulos.test.ts
~~~

Integração: mesmo executável Vitest, run com cada lista abaixo, --config vitest.integration.config.ts --maxWorkers=1. Nenhuma configuração auxiliar.

~~~text
Fase1:
src/server/inbox/barramento.int.test.ts

Fase2:
src/server/inbox/eventos-sse.int.test.ts
src/server/aria/estado.int.test.ts
src/server/aria/pausa.int.test.ts
src/server/aria/expiracao.int.test.ts
src/server/aria/turno/handoff.int.test.ts
~~~

## Admissão e liberação do banco

UNIT/lint ocorreram inicialmente com o ambiente491, sem consultar DB. ROOT depois aplicou492 em 27c78c, preservando os dados e613 triggers antigos; comunicou três funções/615 triggers e424 tabelas. Backup079096: snapshot TESTER492 com1.393 registros. A lease só foi concedida após o global ROOT encerrar: fresh674368 READONLY conferiu424 hashes,1.393 registros, uma sequência, três funções/615 triggers e zero outra atividade/LISTEN. Essas verificações de preparação são provas ROOT, não consultas executadas por mim.

Executei somente as duas suítes autorizadas no DB TESTER492 exclusivo. C5 encerra o LISTEN apenas do current_database, excluindo o pid próprio e filtrando query LISTEN inbox_eventos%; não encerra cluster ou listener de outro banco. Não houve segundo executor DB simultâneo. Ao receber f06ed8 EXIT0, liberei expressamente o TESTER492 ao ROOT, sem executor meu remanescente. Não executei restauro ou auditoria de hashes posterior; ambos cabem ao ROOT. Único helper futuro autorizado: ROOT/output/preservar-banco-tester-cliente-t492-private.mjs. O restaurador TESTER491 não é mais aplicável, independentemente do checkout.

Após minha liberação, ROOT comunicou restauro5f99cc EXIT0:424 hashes/1.393 registros/fixture/snapshot492 preservados, três funções/615 triggers e zero outra atividade. É prova ROOT posterior às execuções, não restauro executado por mim; nenhuma lease permanece ativa.

## Identidade e contrato de produção

A prova própria 11815/544d60 conferiu os18 paths/OIDs/bytes/SHA GitLF com o manifesto DEV de11.220 bytes/4d5f6cee74c0fed17f096da9c65615a484d5c0bcddeb0ca93b6a6fdf4268d383. Cinco arquivos produtivos, nove testes, uma migration e três documentos. Onze protegidos e5.772 outras entradas de árvore permanecem literais; schema/package/lock não mudam. Sete funções de eventos compartilhados e nove do barramento são literais por AST. O quadro preserva o prefixo main GitLF1.147.341 bytes/d9a38f8dff316de762acc508d5eb33377ae20d1e8ba134d75be2d2f812241f37.

Migration nova 20261025020000_inbox_aria_tempo_real/migration.sql: GitLF1.466 bytes/b7c9f6eb0c411a379e4392b5851b18e6a3ea44b4dd4f11661af7aaa3d358441e; físico TESTER CRLF1.505 bytes/9ad86e34e8633819a67febf14b75af64c46f1a86372c9da2eaa32d29857ed2c8, conversão exata. Não apliquei nem editei SQL. São duas funções e dois triggers novos, sem substituir função histórica, ALTER, backfill ou DML de negócio.

AcaoAgenteIA emite atualização individual no INSERT e na mudança real de status; atendimento nulo, status igual, confiança/payload isolados permanecem silenciosos. AgenteIA emite aria.global somente em mudança real de estado ou pausadoEm. INSERT, motivoPausa e supervisaoAte isolados não emitem. Contrato global estrito: exatamente tipo, atendimentoId:null, mensagemId:null e conversaId vazio; campos extras, símbolos, ocultos, não enumeráveis e valores malformados são rejeitados. Não contém payload, motivo ou destinatário privado.

A invalidacão global não concede acesso a dados. A rota SSE permanece literal com sessão/papéis, expiração, revalidação fresca serial e encerramento/reconexão; eventos individuais conservam seus filtros/escopo. A consulta seguinte continua responsável pela ACL de dados. Não há alteração de alçadas, polling ou ação externa.

## O que os oráculos exercitaram

Barramento real usa triggers aplicados e listener PG: contrato público sem conteúdo, status/no-op, dois atendimentos sem mistura, INSERT sem atendimento, transação retida antes do commit, entrega após commit, rollback com barreira positiva posterior, coalescimento de notificações SQL idênticas e coexistência do aviso manual. A sentinela real de pg_notify, emitida por conexão auxiliar sem LISTEN, reduz falsos negativos por notificações ainda não drenadas. Setup de âncora/turno antecede a barreira; subscribers/latches/conexão auxiliar são fechados nos blocos de limpeza. A reconexão C5 voltou a receber mensagem após resync. Os cinco arquivos da fase2 exercitam SSE/estado/pausa/expiração/handoff e não apenas SQL sintético.

NOTIFY só ficou observável após commit; o rollback não entregou evento nos casos cobertos. Strings SQL idênticas coalescem por TX. Não se promete dedup universal entre payloads SQL e JSON manual com representação distinta; o teste de coexistência exige um ou mais avisos válidos.

No cliente, aria.global preserva eventoRecente e só invalida lista/painel. O teste real ReactDOM/useConversa/Historico cobre mensagem+global nas duas ordens no mesmo act, resync→global, globais agrupados e global isolado. Confere recarga coalescida, filtros/contagens, manutenção do aviso/cursor e ausência de busca de thread ou marcação automática por global. Historico e selo pessoal ignoram o global; mensagens continuam seu fluxo. Esse teste não é prova nativa de layout/scroll/foco de navegador.

## Limites e histórico

O parecer preliminar anterior permanece integral e nominal à etapa antes da lease; suas frases de integração pendente são históricas, superadas apenas pelos dois terminais acima. Negativos DEV57d2a9/f5c1cf/989b85/c1be28 e RED50815/eef889 foram preservados, sem reclassificação. Os verdes DEV26 e cinco/48 não foram usados como execução TESTER. TSC DEV3554/52eb7f é auxiliar qualificado com exclusões privadas; não o chamo de original/global. Não executei TSC, global, install/generate/DDL manual, servidor, provider, HTTP/browser, captura ou envio real.

Relógio/orçamento/ConfigIA/publicação de versão não são novos produtores desses dois triggers; expiração depende da mudança de status feita pelo cron. A futura união com #328/#344 precisa preservar os hunks de foco/editor/rascunho/Assumir/fuso e contexto memoizado da lista: ainda não foi exercitada nesta fonte. Gates da composição integrada, CI, publicação e auditoria/restauro ROOT permanecem separados. Este recorte não fecha essas etapas nem homologa interface nativa.

## Artefatos preservados

Tabela abaixo identifica bytes físicos dos logs/relatórios privados; o JSON de identidade contém separadamente GitLF e cópias físicas. Não confundir EOL dos logs com SQL canônico.

| Arquivo em output | Bytes | SHA256 |
|---|---:|---|
| inbox-345-2cd-preliminar-review-tester.md | 11641 | b1057ee40912771c96de29cae724f15f5dc0f3e8e4bf0c9c174dbc5017addcd9 |
| inbox-345-2cd-identidade-tester.json | 12065 | 89701da96294dbb4f60f6c44bcc793cc791b3772e606d863a91af7ede83f18d5 |
| inbox-345-2cd-unit-tester.log | 489 | db81c7188c8e4f4f0654dd768a8c871df6080a10d0be7d4202bba095da3e52be |
| inbox-345-barramento-int-tester.log | 812 | e4756a1863d963dd5412100ef14207399101ebcd119c9ecb203436c094b5994b |
| inbox-345-regressoes-int-tester.log | 812 | e262e06865e7438025df3aaf104b2cc3bbb8fe8e370c84badce7956fe87645e7 |

Resultados estruturados: inbox-345-2cd-final-resultados-tester.json. Nenhum arquivo histórico foi sobrescrito para converter pendência ou negativo em verde.
