# QA independente — Inbox #343

Parecer favorável ao produtor DTO no commit exato 3de12d11e9c604bafc20af0ccab24341be6f807b, pai 54c44b2ad2f5414f346e07dea76001a13c799051. Não identifiquei bloqueador no escopo examinado. Publicação depende da integração e merge da #342, composição e CI original da #343; isto não homologa os consumidores visuais futuros #346/#348.

## Fonte, ambiente e identidade

Worktree exclusivo C:/Users/Mendes/.codex/worktrees/inbox-tester/erp-genius, branch codex/inbox-e3-343-qa, HEAD e tracked limpo confirmados no preflight 6c1794 EXIT0. Perfil tester; banco descartável erp_genius_test_tester em localhost:54329, identificado como TESTER491 pelo integrador. Cliente próprio490 SHA256 647c2586589198b10c9345265e0cce7a43819d5cb44633dbad5e0e0b611fae2b. ROOT preparou checkout e lease; o snapshot f1d15dff3df9ddfab63b8c2e238c0e3d89122c47471d27c8724e20ffd7c291c5 contém 424 tabelas/1.392 registros e preserva 9 mensagens/4 notas originais. Não houve install, generate, DDL ou troca de ambiente pelo TESTER.

A prova privada inbox-343-identidade-tester.json (SHA256 c2ab33b3fb15fd94162c14c7dcbfbaa9bd022d9914941b4007caa8dc3c42806c) registra os 15 paths, OIDs, bytes e SHA256 Git LF e físicos e hashes dos logs. O verificador terminou bf5e23 EXIT0, sessão99175. São 12 arquivos TS e três documentos. Seis funções de ACL/filtros/chips/keyset/página/deep link/thread são textualmente iguais ao pai pelo AST TypeScript: condicoesDosFiltros, contarChipsInbox, depoisDoCursor, listarAtendimentosPagina, obterItemListaInbox e listarMensagensPagina. Nos oito testes cliente, remover somente os quatro defaults recompõe cada arquivo anterior integralmente. Produtor estado-aria.ts e seus dois testes e src/server/aria/uso.ts são byteiguais; prisma, scripts, package/lock e workflows não têm delta. git diff --check pai..HEAD passou.

## Revisão adversarial e comportamento

A ACL continua na consulta antes da montagem. Vazio retorna antes dos loaders e não inicializa ConfigIA; deep link oculto retorna null antes deles. IDs autorizados de fixadas e página são deduplicados; contexto e sugestões são carregados uma vez para esse lote, incluindo 100 fixadas + 200 normais. Não se corta silenciosamente no item200: a integração verifica o item301 na próxima página. Os spies provam somente os loaders adicionais da Aria; não se afirma custo constante de todas as consultas Prisma/preferências herdadas, que agrupam por lidaAte. A inicialização legada de ConfigIA continua possível quando existem itens.

A montagem é compartilhada por página e deep link. O keyset dos atendimentos permanece ultimaMensagemEm DESC NULLS LAST/id DESC; somente a seleção da última mensagem ganha desempate criadoEm DESC/id DESC. Estado e autoria são independentes. atendidoPorVoce compara responsavelId da conversa ao usuário e não concede permissão nem usa dono comercial.

A prioridade executada é sugestão vigente estritamente posterior (ou sem mensagem), entrada/ausência, IA, autor próprio, outro HUMANO/CELULAR com nome e restantes nulos. IA vence autorId próprio; automático de autoria própria é voce. Empate temporal não faz sugestão posterior. Nome é normalizado e reduzido ao primeiro nome. No produtor real, autorNome vem da relação da mensagem; autor ausente não fornece nome independente. A sugestão seleciona atendimentoId/acao/criadoEm e expõe apenas o label existente da ação. resumirConversa constrói o DTO explicitamente e mantém preview da última mensagem, sem espalhar mensagem/autor/payload. O teste com SEGREDO_SUGESTAO_343_NAO_SERIALIZAR verifica ausência no JSON retornado. Nenhuma produção cliente ou interface visual foi alterada.

## Execuções próprias, completas dentro dos recortes

Executável C:/Users/Mendes/AppData/Local/hermes/node/node.exe e Vitest local node_modules/vitest/vitest.mjs; sem filtros de caso, skips ou exclusões adicionais.

| Gate | Comando/escopo e resultado terminal |
| --- | --- |
| UNIT | run previa.test.ts, cursor.test.ts, filtros.test.ts e os oito testes cliente modificados (paths completos na prova JSON), --maxWorkers=2. 80a7f7 EXIT0: 11 arquivos/112 testes,5,41s. Log output/inbox-343-unit-tester.log. |
| INT | run src/server/inbox/consultas-pagina.int.test.ts --config vitest.integration.config.ts --maxWorkers=1. Início0e252c/session46846, terminal8ff3c3 EXIT0: arquivo completo/32 testes,122,49s. Log output/inbox-343-int-tester.log. |
| Lint | ESLint local nos 12 paths SRC reais de git diff --name-only 54c44b2..3de12d11 -- src, --max-warnings=0. 201524 EXIT0, log output/inbox-343-lint-tester.log vazio. |

Os nove UNIT de autoria cobrem prioridades cruzadas, automático/próprio, entrada, nomes e sugestão anterior/igual/posterior. Os oito novos INT cobrem DTO página/deep link, responsabilidade, labels sem segredo, expiração, handoff/pausa, empate de mensagem, ACL/vazio e lote300/cursor. Os 24 INT anteriores de paginação/fixadas/preferências/escopo/contagens também passaram no mesmo arquivo. Logs apresentam avisos de configuração mixed exports/vite-tsconfig-paths, sem falha. Não somei esses recortes aos gates DEV.

O banco foi explicitamente LIBERADO ao ROOT após terminal8ff3c3, sem atividade DB posterior pelo TESTER. Restauro posterior cabe ao integrador. Nenhuma execução TSC própria/auxiliar nem global foi feita, conforme escopo aprovado. DEV relata global938/7.434, INT32, lint12 e TSC auxiliar; são evidências separadas e não substituem CI original da composição. Não houve browser, HTTP de produto, Save, nota manual, provedor real ou captura visual.

## Negativos administrativos e limites

798a58 EXIT1 decorreu de leitura de um nome de SPEC presumido; a SPEC correta inbox-estado-previa-lista.md foi lida em04d620 antes da INT. Verificador estático inicial73ec6e falhou por assumir uma só formatação dos defaults;373525 falhou pelo path presumido whatsapp/uso.ts. Foram corrigidos somente no script privado, preservando produto e gates. O terminal bf5e23 confirma as duas variantes reais e o path aria/uso.ts. Não são negativos de produto nem foram apagados.

As provas são nominais a este commit e a esta lease. Não abrangem desempenho medido do banco inteiro, renderização de futuros badges, novas alçadas, integração remota concluída ou fechamento de issue. Nenhuma homologação visual foi inferida de testes de DTO.
