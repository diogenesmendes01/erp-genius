# QA #340 — Fase1, autoria e domínio puro

Base db441f0c13ca328c3935a6c331bd683c5b365746; branch340 própria. Runtime338/pins/AGENTSM históricos preservados. A498 restaurado ROOT77810e; sem lease SQL340.

- RED bfdb35 EXIT1: módulos puros inexistentes,2suites sem testes coletados. Não é REDSQL nem prova de falha em produto já integrado.
- GREEN770485 EXIT0:2arquivos47casos,868ms. Novos testes de whitelist raw/tupla adicionados depois.
- Final b5467c EXIT0:4arquivos83casos,2,60s, UTC/w1/heap1024/no-file-parallelism. Arquivos completos: src/server/crm/pessoa-cadastro-schema.test.ts; src/lib/idade-civil.test.ts; src/server/_shared/validacao.test.ts; src/lib/data-civil.test.ts. Sem filtros de caso/skips. Inclui regressões canônicas, não é global/nativo.
- Lint4files e41ff6 EXIT0/0avisos antes dos2testes aditivos finais. Novo lint final aguarda liberação de Node ROOT por pressão de memória; nenhum bypass/disable.

Contrato testado:6validadores LATAM, leniência semCPF-only, omissão/null/vazio e tupla; ISOemissor independente; calendário/DOB cominstante recusado; snapshots semextras raw; auditoria sópresença; idade0/1890/leapday29fev→1mar/futuroNULL/virada institucional sem fallback.

Schema499 SHA926e5679a22aebe7c396f7f3b41f7bd68583770599118bc88ceba90e62d600d3. SQL SHA b10889625df3dfe95afbec737d28c8c02e102eba42dc758aee2d767fd8adc5b6. Manifesto privado output/inbox-340-schema499-freeze-private.json. Somente autoria; sem validate/generate/DDL. ClientA498cd7/perfil6758/AGENTS0544 preservados. No schema não há default/UNIQUE/backfill nem alteração de Aluno.

Auditoria RO output/inbox-340-raw-serializacoes-locks-ro-private.md SHA061a219de25993e300754b53c1533c26cf8fb79ad1060d2ecc9f0fd58f478867: raw internos editarPessoa/mescla, DTOs examinados explícitos, Insights sem expansão automática. Busca textual não substitui testes de nãoleak. Logger de erros inesperados e vetos de excluirTipo ainda serão tratados no delta shared coordenado. Ano0000 é ponto técnico pendente antes persistência.

NÃO executados: Node pesado/AST/TSC/global, SQL/nativos, providers/integrações, UI/browser/visual. Não há gate Doc/DOB real nem writer/endpoint habilitado nesta fase. Próximos dependem client499 e GO ROOT. #340 incompleta; não homologada.
ROOT aprovou refinamento DOB específico0001..9999 por representaçãoDATE/contratoYYYY, sem corte etário. Testes de0000/10000 recusados e0001/9999 representáveis foram autorados após b5467c, ainda NÃO executados por reservaNode do geradorROOT. Nenhuma implementação desse refinamento antes de observar RED; validador genérico permanece literal.83casos não devem ser reatribuídos à fonte pósrefinamento.
## Fechamento da fase1 — domínio puro, sem runtime

RED61cc71 EXIT1:2arquivos54casos,2falhas/52controles. SchemaDOB aceitava0000 e idadeCivil devolvia2026 para0000-01-01. Implementação mínima específica em src/lib/nascimento-civil.ts, reutilizada pelo patch Pessoa e idade; validador DataCivilSchema genérico permanece literal e seu comportamento0000 é controle positivo separado.

GREEN5ca2c3 EXIT0:4arquivos88casos,1,76s. Mesmos4paths completos descritos acima, UTC/w1/heap1024/nofileparallel/7provedores vazios, sem filtros de caso/skips. Não somar os83 anteriores sobrepostos. Lint final73cf32 EXIT0,5paths/0avisos: pessoa-cadastro-schema.ts/.test.ts, idade-civil.ts/.test.ts, nascimento-civil.ts. Todos executores encerrados e Node liberado explicitamente ao ROOT.

Infra fornecida ROOT, não executada pelo DEV: validate62dfb1 EXIT0; client4992cf80d564bae0d2b1d5ec764e9ddbae5652dc850ebda57afa00b1c944a5ea047; DDL efc083 EXIT0 somenteA,497migrações reais/426tabelas,4camposNULL e projeção antiga dePessoa preservada/FK/index corretos; snapshot d158d7 EXIT0,426hashes/563linhas. Restaurador exclusivo output/preservar-banco-devemail-a499-private.mjs, nunca498/495. Lease SQL340 continua NONE.

Arquivos puros não estão importados por writers/DTO/UI. Gate sensível, fresh locks/ACL, exclusãoTipos, logger/sanitização, nativos/SSR/DOM/gates originais/QA/visual permanecem fases seguintes dependentes de GO ROOT. Não é funcionalidade340 concluída. AGENTSM histórico preservado e fora do commit.
## Checkpoint fase2 — recorte UNIT writer/leitor

As afirmações anteriores de ausência de ligação descrevem a fonte da fase1. Nesta candidata o contrato puro já é importado pelo writer CRM; o leitor é privado, sem wire público/DTO/UI. A499 permanece baseline ROOT; nenhuma lease SQL foi concedida ao DEV340.

- Coleção negativa5faa01 EXIT1: leitor ausente, 0 casos nesse módulo; não é RED de produto. Scaffold neutro permitiu RED assertivo e78574 EXIT1: dois arquivos/12 casos, sete falhas/cinco controles.
- GREEN sessão77988 até terminal c33780 EXIT0: mesmos dois arquivos completos/12 casos. Lint4paths ba7993 EXIT0, zero avisos.
- Sentinelas adicionais REDc4ec58 EXIT1: 14 casos, duas falhas/12 controles (revogação dentro da seleção sensível final e atribuição incorreta de FK indeterminada). GREENb5847e EXIT0:14/14; lint2daf16 EXIT0.
- Barreira de callback pós-Evento RED5c463d EXIT1:16 casos, uma falha/15 controles; revogação CRM dentro do último callback ainda retornava true. Patch mínimo reordena somente o ramo cadastral para callback e depois revalidação CRM. GREENad0bc5 EXIT0: dois arquivos/16 casos,1,17s. Linta70ce9 EXIT0, cinco paths/zero avisos.

Arquivos UNIT completos: src/server/crm/pessoa-cadastro-escrita.test.ts e src/server/crm/pessoa-cadastro-leitura.test.ts. Todos os ciclos usaram config original, UTC, heap1024/w1/sem paralelismo de arquivos/sete providers vazios; sem filtro de caso/skip. Os recortes se sobrepõem: não somar12+14+16. Lint final: contatos.ts, pessoa-cadastro.ts, pessoa-cadastro-schema.ts e os dois testes. Executor final síncrono não retornou session_id; chunks terminais acima são a prova. Node liberado explicitamente ao ROOT após cada janela.

A barreira de binding pós-Evento em unidade comprova propagação da rejeição e ausência de aviso/commit no harness; NÃO comprova rollback PostgreSQL de Pessoa/Evento/NOTIFY. Isso exige nativo futuro. RO dos retornos atuais: contatos.pessoaNoEscopo raw é privado ao núcleo; duplicados carrega raw internamente, mas prévia é projeção explícita; painel mantém PessoaPainel explícito; contexto Insights seleciona somente os campos antigos da oportunidade; mensagens-agendadas seleciona somente pessoa.nome. Não houve expansão automática de prompt/DTO. Testes de JSON/SSR e revalidação completa da fronteira Inbox ainda pendem antes de wire.

## DTO e wrapper Inbox — unidade, antes dos nativos

REDb472b9 EXIT1: dois arquivos/10 casos, nove falhas/um controle legado. GREEN68d955 EXIT0: mesmos arquivos completos/10 casos,1,98s. Lint0af0c2 EXIT0: sete paths/zero avisos. UTC/w1/heap1024/nofileparallel/sete provedores vazios, sem filtro de caso/skip; execuções síncronas sem session_id, chunks terminais registrados. Logs privados inbox-340-fase2-dto-wrapper-{red,green,lint}-private.log. Não somar esse recorte ao16 anterior como se fosse regressão global.

Novos testes: src/server/inbox/painel-detalhes-cadastro.test.ts e acoes-painel-cadastro.test.ts. PessoaPainel409 mantém a mesma projeção; novos blocos cadastroPessoa/informacoesCadastro são NULL constantes quando negados e valores autorizados vazios têm quatro NULLs. UNIT cobre guestProfessor, setor nãoCOMERCIAL, revogação CRM, escopoPessoa negado apesar de lead e rebind durante leitor/aviso. O wrapper revalida somente o ramo cadastral, após aviso, na conexão TX; payload legado omitido conserva caminho existente. Snapshot mínimo de binding não contém documento/nascimento. Header/capacidades permanecem literais.

Três fixtures tipadas (AbaDetalhes.test.ts, GavetaContato.test.ts, form-contato.test.ts) receberam apenas as duas propriedades NULL obrigatórias. Foram lintadas, mas suas regressões ainda não foram executadas neste checkpoint. UI runtime ainda não apresenta/edita os novos campos. Não há prova SQL de locks/rollback/NOTIFY nem homologação/visual. Node liberado ao ROOT após ciclo.

Reexecução das três fixtures completas:04bf88 EXIT0,3arquivos28casos,1,64s, UTC/w1/1024/7blank/sem filtro de caso/skip. AbaDetalhes.test.ts, GavetaContato.test.ts e form-contato.test.ts; apenas duas propriedadesNULL aditivas na fixture, sem mudança runtimeUI. Log output/inbox-340-fase2-fixtures-green-private.log. Isso substitui a pendência de execução dessas três fixtures acima; SQL/novos campos em tela/visual continuam pendentes. Node liberado imediatamente.

## UI Inbox e veto TipoDocumento — recorte SSR/DOM local

RED2c401d EXIT1: quatro arquivos45casos, oito falhas/37 controles. Tipos/form/SSR tiveram falhas assertivas; três casos DOM falharam ao buscar controles ainda inexistentes (TypeError), portanto esse RED não prova individualmente ACK/revogação. Após implementação, todos passaram com controles reais. Três controles aditivos foram autorados depois do patch inicial (omissão de Doc/DOB ao salvar só nome após refresh e handler antigo), sem RED retroativo.

GREENdfed03 EXIT0:4files48. Lintad2098 EXIT1:15 diagnósticos react-hooks/refs somenteGaveta; invalidação usava ref em render. Corrigido com estado para render e ref somente em efeito/handlers, sem exceção à regra. GREEN finale12dd6 EXIT0:4files48casos completos/2,07s. Linte323f3 EXIT0:10paths/zero avisos. Todos UTC/w1/1024/7blank/sem filtro de caso/skip, síncronos sem session_id; Node liberado.

Arquivos completos: paises/tipos-documento.test.ts, inbox/abas/form-contato.test.ts, AbaDetalhes.test.ts e GavetaContato.test.ts. DOM usa React real e harness local; não é browser/visual nem SQL. Rascunho/input físico preservados em refresh autorizado; negação retira controles e exclui dados cadastrais do payload, invalida ACK/handler antigo até nova abertura. Editar só nome omite os quatro campos, inclusive após alteração concorrente do cadastro recebido. LimpezaNULL somente no campo alterado para vazio. Nascimento permanece civil/idade0 somente leitura.

TipoAtual passa a exigir count.pessoas; editarPais conta alunos+pessoas e deleteMany exige ausência de ambos, com FKRestrict. Unidade prova veto de Pessoa sem Aluno e renomeação por ID; corrida SQL ainda pendente. Ficha globalCRM/obterContato, nativos/locks/rollback/NOTIFY, guardas/gates originais, QA independente e visual continuam pendentes. #340 permanece incompleta.

## Ficha globalCRM e cache local — checkpoint

RED inicial9bc1cd EXIT1:4arquivos31casos,7falhas/24controles. As falhas de cache nesse primeiro ciclo eram ausência do DTO; NÃO são causalidade de cache. Após wire temporário somente no WIP local, contraprova bf2e39 EXIT1:2arquivos7casos,2falhas/5controles; agora o getter retornava DOC PROTEGIDO após revogação de cobertura/equipe com os mesmos papéis na mesma request aquecida. Esse wire intermediário não foi commitado nem servido publicamente.

O teste usa cache REAL do React embarcado no Next16.3.5, módulo instalado next/dist/compiled/react/cjs/react.react-server.development.js, SHA c52fcea71691c0466496dac0c2000b3c2606143ab858fc341b0d3df88949d931. Dispatcher request-local instrumental é restaurado afterEach e Vitest isola módulos; não é renderizaçãoRSC real/browser/SQL. Controles confirmam memo primitivo, nova request e caminho sem dispatcher. A prova SQL com cobertura revogada COMMIT em outra conexão ainda será autorada/executada sob lease futura.

Correção local: somente leitura cadastral global roda em TX curta ReadCommitted e passa tx ao helper, evitando identidade singleton e seu memo. Getter antigo/defaults globais/assinaturas não mudaram; não há nestedTX no helper nem novo DTO sensível memoizado. GREEN011d5b EXIT0:4files31/31,3,02s; lint8a61b5 EXIT0,6paths0avisos. UTC/w1/1024/7blank/sem filtro/skip, execuções síncronas; Node liberado.

Arquivos completos: crm/contatos-cadastro.test.ts, crm/contatos-cadastro-cache.test.ts, contatos/FichaContato.test.ts e FichaContato.nota.interacao.test.ts. FichaContato SSR usa ReactDOMServer; interação global usa harness legado tela-sem-dom/hooks instrumentados, NÃO DOM físico. Cobre payload com clearDOB explícito, omissão de quatro campos não alterados e númeroLATAM leniente. DOM físico/ACK/input estável já foi exercitado na GavetaInbox; globalDOM/visual continuam pendentes. A ficha recebe os mesmos dois blocos por gateCRM fresco sem inventar atendimento; contatos-acoes permanece literal. Não há expansão de lista/export/Aria/Aluno.

## Revisão de callbacks globais — ReactDOM real

TESTER RO e232 identificou closures antigas; não havia bypass servidor comprovado. Oráculo autorado antes do patch, sem mock de hooks: FichaContato.cadastro.dom.test.ts. RED28ae33 EXIT1:6casos/4falhas/2controles — callbacks retidos despachavam documento antigo após DTOnegado ou capacidade revogada/reconcedida, ACK antigo acionava refresh e onChange antigo alterava draft durante busy. Novo teste usa ReactDOMClient/StrictMode e dom-mínimo, não browser visual.

Correção somente no ramo cadastral: refs de vida/gate/busy/geração atualizadas por efeitos; guardas antes de mudança/dispatch e depois de ACK. Rodar/payload legados permanecem. Negação invalida a geração na mesma abertura e nova autorização não reutiliza draft/ACK; reabertura deliberada inicia estado novo. Nome/Cidade/input físico e omissão de Doc não editado são controles positivos. GREEN sessão35230 acompanhada até terminal6e5d43 EXIT0:6/6. Lint32dc98 EXIT0:3paths/0avisos.

Fixture legada FichaContato.nota.interacao.test.ts recebeu mock useEffect explícito de payload; NÃO é prova de ciclo de vida. Sua regressão5 após esse ajuste ainda aguarda janela. A prova de callbacks é o arquivo DOMreal6 independente. Não reatribuir31 anterior à nova fonte nem somar recortes sobrepostos.

A partir deste ciclo, output/inbox-340-node-cli-private.mjs atribui process.env[nome]='' aos sete nomes canônicos e TZ=UTC ANTES do import dinâmico do CLI original; preserva argv/config. Isso evita a remoção de variável vazia pelo PowerShell5. Bootstrap não lê/imprime segredos, não altera .env/deps/config. Heap1024/w1/nofileparallel, sem filtro/skip; Node liberado. SQL/QA independente/visual permanecem pendentes.

## Early gate do writer — antes da seleção de valores

Correção de descrição estática: SELECT id FROM Pessoa FOR UPDATE já existe no núcleo editarPessoaNaTransacao; pessoaNoEscopo só faz findFirst/includeAluno. Não foi adicionado lock duplicado. REDfe1007 EXIT1: dois arquivos20casos, quatro falhas/16controles. Portal, inativo, sem editar e revogação instrumental durante SELECTid ainda permitiam seleção dos quatro escalares antes de recusar a escrita. Não é vazamento público executado nem prova SQL.

Patch apenas quando temCadastroPessoa: após lock de identidade e callback já existentes, relê ator ativo/nãoPortal/ver+editar; só então pessoaNoEscopo consulta os valores e o escopo na tx. Omitidos/no-op/assinaturas/revalidações finais preservados. GREEN554bc6 EXIT0:2files20/20,1,30s. Lint2f265e EXIT0:3paths0avisos. Bootstrap Node pré-import/UTC/w1/1024/sem filtros de caso/skips; executores síncronos sem session_id. Node liberado. A correspondente espera SQL real/roleCOMMIT está somente autorada, ainda não executada nem admitida.

## Janela commit→efeito passivo — callbacks antes do paint

TRO874 observou que seis casos com awaitact já descarregavam passivos. Oráculos adicionais preservam ancestral desde a montagem inicial e disparam callback retido no useLayoutEffect do ancestral no MESMO commit de negação. Gaveta também afirma o mesmo nó físico do formulário. RED203cb8 EXIT1:2files27casos, duas falhas/25controles — payload cadastral saiu antes do passivo tanto global quanto Inbox. Isso prova envio indevido do cliente em fixture, NÃO bypass de autorização servidor.

Correção em layout no filho publica/veta as refs antes do ancestral. GREEN intermediário10e1f7/27 e harness744831/5 pertencem à versão que também antecipava o efeito legado de vivo.current da Gaveta. Refinamento final aprovado preservou ESSEuseEffect literal do legado; somente cadastroInvalidadoRef novo passou a publicar/limpar em layout. Ficha usa layout só nas refs novas340. Sem ref no render, remount ou nova permissão.

GREEN final f54147 EXIT0:2files27/27,2,24s; harness legado ade8cf EXIT0:1file5/5; lint5348be EXIT0:5paths0avisos. Arquivos DOM completos: FichaContato.cadastro.dom.test.ts(7) e GavetaContato.test.ts(20); harness FichaContato.nota.interacao.test.ts continua qualificado como payload semDOM. Bootstrap pré-importsete strings vazias/UTC/w1/1024/sem filtro/skip. Executores síncronos encerrados e Node liberado. Não somar recortes sobrepostos nem reatribuir GREENintermediário à versão final. SQL/guardas/gates/QA/visual continuam pendentes.

## Nativos — autoria congelada, nenhum executado

Sete arquivos completos/33 casos AUTORADOS por inspeção das declarações, com contagens7/5/8/3/3/4/3. Nenhum caso foi coletado/executado no Postgres e não existe RED/GREEN nativo340. Lint73d6e3 EXIT0: nove paths/zero avisos (sete arquivosINT, fixture e adaptação nominal). SQL A499 continua sem lease; não houve pg_cancel_backend/DDL/generate/instalação/alteração de cluster.

Arquivos: crm/pessoa-cadastro.int.test.ts(7); inbox/painel-cadastro-pessoa.int.test.ts(5); inbox/pessoa-cadastro-concorrencia.int.test.ts(8); inbox/pessoa-cadastro-notify.int.test.ts(3); inbox/pessoa-cadastro-pool1.int.test.ts(3); crm/pessoa-cadastro-cache.int.test.ts(4); crm/pessoa-cadastro-redacao.int.test.ts(3). Fixture src/test/inbox-cadastro-pessoa.ts. painel-detalhes.int.test.ts recebeu somente os dois blocos obrigatórios em quatro comparações exatas, sem relaxar asserções.

Plano: domínios/omissão/clear/civil/LATAM/Aluno/mescla/TipoFK; guest409oldDTO versus novaPII2NULLs; escopo/COMERCIAL; holdersPessoa e pg_blocking_pids reais com papel/carteira/binding alterados e COMMITados em outra conexão; pósEvento instrumental com SQL real; Tipo/UserDELETE retidos e NOWAIT; dois writers reais preservando omissão; LISTEN real commit1/replay0/rollback0; pool1; cacheREALNext+dispatcher instrumental e revogaçãoSQL; loggerPrisma com canário obrigatório antes de cancelamento da própria query bloqueada.

O canal Prisma console.error foi confirmado estaticamente no runtime, mas coleta real ainda será verificada pelo primeiro canário SQL1/0. O teste de cancelamento repete esse controle DENTRO do próprio caso e só prossegue após capturar prisma:error; pool1 captura pg_backend_pid/current_database da própria conexão antes da action e valida banco/application_name/UPDATEPessoa/holder exatos antes de pg_cancel_backend(ownPID). Nunca selecionar PID por busca ampla, terminar backend/cluster ou usar outro banco. Tudo aguarda readmissão ROOT/dev-email/A499 e lease explícita.

Após os novos arquivos passarem, regressões completas previstas (contagens só no terminal): crm/contatos.int.test.ts, crm/pessoas.int.test.ts, crm/duplicados.int.test.ts, inbox/painel-detalhes.int.test.ts, inbox/acoes-painel-contato.int.test.ts e inbox/acoes-painel-contato-pool1.int.test.ts. Um arquivo/sessão por vez/configoriginal/UTC/w1/1024/7stringsvazias/semfiltro/skips. Source/pins/RO precisam ser admitidos antes da execução. SnapshotA499426hashes563linhas/restaurador499 exclusivoROOT; nunca498. #340 permanece incompleta: SQL, guardas/gates originais, QA independente, browser/visual e composição/publicação pendentes.

Precisão da autoria: a adaptação nativa tem quatro comparações exatas (uma autorizada e três negadas; duas negadas ficam em loops), e não duas como descrito no primeiro draft privado. Os dois blocos novos são aditivos; nenhuma asserção antiga foi retirada ou convertida em parcial.

## Primeira execução nativa e correção de expectativa — replay ainda pendente

Fonte2eab44f0: primeiro arquivo completo crm/pessoa-cadastro.int.test.ts, sessão61594 acompanhada até terminal2c463e EXIT1;7casos,6pass/1fail, sem filtro/skip. Demais seis novos e seis regressões NÃO iniciados. O DELETE real foi recusado por PostgreSQL SQLSTATE23001/RESTRICT Pessoa_tipoDocumentoId_fkey, exposto como PrismaClientUnknownRequestError5.22.0. A falha foi exigir o mapeamento PrismaP2003. Não é falha demonstrada do veto nem RED préimplementação. As verificações de manutenção/rename após essa expectativa NÃO executaram; os seis controles anteriores não são homologação global.

Lease/Node liberados imediatamente. ROOT restaurou A499 ca0953 EXIT0 com hashes/snapshot íntegros e revogou a lease. Recibo privado inbox-340-native-first-failure-private.json SHA617cf42681432597ce395dc5a3d6523aa7cbb5962b694ec8df1e5cdfef6697f4; log original preservado.

Correção autorizada SOMENTE no teste: exige Error com PostgresError/code23001/constraint exata e estado Pessoa+Tipo ainda íntegro antes da manutenção; não aceita throw genérico. Runtime04eed/schema499/client/perfil não mudaram. Lint focal sessão67278 até terminalebc6d7 EXIT0/zero avisos. NÃO houve replaySQL nessa nova fonte; aguarda readmissão/leaseROOT. Contagem autorada continua33, nenhum outro arquivo nativo executado. #340 permanece parcial.

## Concorrência0482 — negativo preservado e instrumentação corrigida

Core completo94698/9de5ce EXIT0:7/7; painel82596/b60230 EXIT0:5/5, fonte0482. Concorrência sessão52978 até bf632f EXIT1:8casos,6pass2fail. Parei antes do arquivo4, liberei lease e ROOT restaurouA49990fba8 EXIT0. Demais4novos e6regressões não iniciados. Runtime04eed literal.

Retarget falhou na fixture porque o SQL usava Oportunidade, mas modelOportunidade tem @@map("Lead"). A mutação não executou; esse caso não provou o retarget. O caso doiswriters exigia dois bloqueios DIRETOS no holder e observou apenas1, sem gravar o grafo; não ficou demonstrada causa soft-block nem falha/deadlock do produto.

Correção somente no arquivo de teste: UPDATE Lead e captura do PID/app pelo próprio tx de cada writer, mais holder já conhecido. A amostra pg_stat_activity consulta somente esses3PIDs e registra query/wait_event_type/wait_event/pg_blocking_pids. Exige DOIS writers distintos em Lock, mesma SELECTPessoaFORUPDATE, blockers conhecidos e caminho direto OU indireto observado até holder. Preserva checks finais de dois resultadostrue/Pessoa/Eventos2. Grafo é salvo após soltar/drainar/disconectar, inclusive em falha; sem I/O segurando TX. Não muda locks/timeout do produto.

Referência primária: [PostgreSQL18 pg_blocking_pids](https://www.postgresql.org/docs/18/functions-info.html#FUNCTIONS-INFO-SESSION-TABLE) inclui conflitos de locks e precedência na fila. Isso justifica examinar o grafo, mas não determina qual caso ocorreu nesta execução. Novo lint7dedac EXIT0,1path0avisos. Core/painel anteriores não serão reatribuídos a novo runtime nem repetidos sem mudança; seus blobs e runtime serão comparados antes do arquivo 3. Nova execuçãoAPENAS8 ainda pendente nesta autoria.


### Instrumentação do cache nativo — revisão test-only
O negativo 2e97b0 (1 passou/3 falharam) terminou antes do catálogo: as três revogações não ocorreram. protegerTransacoes captura o cliente base; a extensão derivada não observava a TX real. O teste agora observa por callthrough a transação protegida e o tipoDocumento.findMany efetivamente concluído. Cada cenário exige canário SQL/captura/retorno no mesmo caminho antes da revogação. React.cache instalado e dispatcher instrumental permanecem; não é renderização RSC/browser. Lint focal 12601/47af1c EXIT0. Runtime 04eed permanece literal. Arquivo7 e seis regressões seguem não executados; #340 permanece parcial.


### Coletor de logger nativo (test-only)
Negativo 68385/7b2518: 3 casos, 1 passou/2 falharam no canário console.error; Prisma emitiu prisma:error em stdout. O cancelamento não foi alcançado. Runtime instalado library.js contém emissores console.log/error/warn/info; o coletor agora observa os quatro com callthrough preservando emissão e registra o canal real do canário antes do teste. Ausência de Doc/DOB, ownPID/banco/app/UPDATE/holder seguem mandatórios. Lint82982/a4f108 EXIT0. Runtime04eed literal; nova execução ainda pendente neste checkpoint.

### Nativos e regressões executados — fonte 25a93e83
O arquivo 7 completo passou em 93774/e63469 EXIT0 (3/3). Os dois canários registraram o canal real console.log com emissão preservada. O cancelamento foi somente da conexão própria, com PID/banco/app/UPDATE/FKholder conferidos; ausência de Doc/DOB e rollback foram verificados. O negativo 7b2518 permanece preservado e naquela execução o cancelamento não foi alcançado.
As seis regressões completas passaram, em série: contatos 66056/d6fb34 (5), pessoas 27193/f300c2 (16), duplicados 72700/3d3b2c (14), painel-detalhes 61600/a5cac7 (16), acoes-painel-contato 78364/fecf43 (21), pool1 18618/918ff6 (1): 73 casos nesta seleção, sem filtros/skips. Original integration config, UTC, w1, heap1024, no-file-parallelism e sete provedores vazios via bootstrap. Não é suíte global.
Proveniência dos sete novos arquivos sem repetição indevida: arquivos 1/2 verdes 0482 (7/5), arquivo 3 verde 34c7 (8), arquivos 4/5 verdes 34c7 (3/3), arquivo 6 verde 6a6c (4), arquivo 7 verde 25a9 (3). São 33 casos distintos; históricos negativos preservados. Os 27 pins foram reconferidos; runtime 04eed/schema/client/perfil literais. Lease e Node liberados para restauro exclusivo ROOT A499; baseline não presumida.
Recibo privado output/inbox-340-native-final25a9-receipt-private.json SHA f57383c26da54ae3b3b1d2e6293b0ab24178fbe8aa02efb10819f550b2dc920e. #340 permanece parcial: gates originais/QA independente/visual e publicação seguem pendentes; puros/DOM não são browser.