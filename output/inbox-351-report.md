# #351 — relatório DEV do resumo de handoff

Base: b292bf791e2a4762f892a68bba87a9de5f407b5f. Branch: codex/inbox-e3-351-handoff. O ROOT preparou cliente próprio 490, perfil ci-integracao e ciint 491, com 502 registros e 424 hashes conferidos em 111be4. O plano a6b5e99c foi aprovado em 7164e1, com parser canônico, descrições genéricas para dados restritos, tarefa autorizada por ID e extração literal da visibilidade. A publicação depende da integração da #349/PR424.

[Contrato](../docs/specs/inbox-handoff-resumo.md): última HANDOFF EXECUTADA, motivo seguro, nota da ação, dez ações autorizadas por keyset e capacidade atual de fila/linha. Todos os loaders usam o Db recebido. Não há consumidor novo, ação, alçada D1–D3, schema, migração ou dependência. Tarefa usa payload.tarefaId persistido e escopoTarefas; capacidade isolada não libera título.

## TDD e negativos preservados

- UNIT RED 52931/861ffd, EXIT1: 12 falhas e 129 passes em 141 casos, além de arquivo sem coleção por loader ausente. Parser e mapa ainda não existiam.
- INT RED 5941a6, EXIT1: módulo ausente, zero casos coletados. Esse resultado não comprova comportamento DB.
- UNIT 76879/2b43db, EXIT1: 153/154; somente a guarda de mapa contextual falhou. ROOT b56fcc aprovou uma entrada exata em MAPAS_DE_DOMINIO para handoff-inbox.ts, nome “switch acao”, por descrição histórica com payload/fallbacks. O classificador não mudou; ETAPA_LABEL permanece para o rótulo verdadeiro.
- TSC 50484/99baad, EXIT2: fixture/loader trataram resultado como coluna. O executor real mostrou resultado.tarefaId local mesclado no payload. A correção ficou na #351, sem mudar schema ou executor.
- Primeiro GREEN: INT 36014/16bd71, 16/16, 67,68 s; UNIT 79361/186ba2, três arquivos/154 casos; TSC 68970/794b82, todos EXIT0. São nominais à versão anterior ao reforço do preâmbulo e das fixtures finais.
- Preâmbulo vazio: RED a455a9, duas falhas e dez passes em 12; GREEN b203a7, 12/12, EXIT0. O ajuste mínimo do parser não alterou o formatter. A ambiguidade do conteúdo que imita rótulo posterior continua explícita.

## Gates finais e atribuição

Todas as execuções abaixo chegaram ao terminal da mesma sessão, com código 0. Não houve filtro por nome nem teste ignorado nesses recortes. Não se somam arquivos sobrepostos.

| Gate | Sessão/terminal | Resultado |
| --- | --- | --- |
| UNIT do recorte completo | 45914/cbccdf | 29 arquivos, 420 casos, 28,47 s |
| INT do recorte completo | 50642/4afe5a | Cinco arquivos, 68 casos, 275,93 s |
| TSC auxiliar do recorte | 54397/075fbd | EXIT0 |
| Lint dos 12 paths de fonte/teste | 18b2c5 | EXIT0, sem aviso |
| INT após reforço exclusivo da fixture | 59826/ec297e | handoff-inbox.int completo, 16 casos, 73,91 s |
| TSC auxiliar após fixture final | 13026/0d4887 | EXIT0 |
| Lint da fixture final | c73316 | EXIT0, sem aviso |

O delta posterior ao recorte de cinco INT foi somente a fixture: prova de tarefa não commitada no mesmo Db/pool1, ausência após rollback e convite expirado antes da revogação. A produção e os testes UNIT permanecem idênticos. O recorte de 68 e o arquivo final de 16 são execuções distintas; não são um único comando de 84 casos.

UNIT executou todos os arquivos de src/server/aria e estes cinco paths adicionais: src/app/enums-rotulos.test.ts; src/server/whatsapp/visibilidade-lead-db.test.ts; src/app/(app)/inbox/PainelAtendimento.aria.test.ts; src/server/inbox/permissoes.test.ts; src/server/inbox/paineis-tags.test.ts. Configuração vitest padrão, maxWorkers=2. Não é UNIT global. ROOT dispensou a repetição global DEV com este recorte sólido; a CI global da publicação permanece pendente.

INT executou com vitest.integration.config.ts e maxWorkers=1 os arquivos completos: src/server/aria/handoff-inbox.int.test.ts; src/server/aria/turno/handoff.int.test.ts; src/server/whatsapp/consultas-inbox.aria.int.test.ts; src/server/inbox/consultas-pagina.int.test.ts; src/server/whatsapp/nota-interna.int.test.ts. A última execução repetiu somente o primeiro arquivo, já com a fixture reforçada. Uma suíte por vez no ciint exclusivo, sem processo desacoplado.

TSC usa heap de 8192 MB, --noEmit --incremental false e tsconfig.inbox-342-aux-private.json. A auxiliar estende a configuração original e preserva seus includes/excludes, acrescentando somente os dois privados históricos autorizados: output/inbox-326-a2-diagnostico-private.test.ts e output/inbox-326-package-r8-7a30d4-preservado-private/inbox-326-a2-diagnostico-private.test.ts. Todos os SRC/testes atuais estão incluídos. O TSC original e o lint global deste worktree com privados não são declarados verdes; o integrador verificará checkout limpo.

## Identidades e fontes

Prova 77429/edbd4f, EXIT0: montarNotaResumo, executarHandoff e 11 outras funções de consultas permanecem literais. A função completa extraída de podeVerLeadNaThread (export, assinatura e corpo) tem 633 bytes LF e SHA256 e68b8aee4fdfa9c6934fb7c378a1357c60c2b55eeb66e06615b914fbedabb4c7. Os 13 textos antigos do Playground e 13 paths protegidos são iguais à base. Não há alteração de #349, #342, uso, executor, tarefas, schema ou dependências.

Hashes SHA256 da fonte final, em LF; os bytes físicos destes arquivos também estão em LF:

| Arquivo | Bytes | SHA256 |
| --- | --- | --- |
| handoff-inbox.ts | 7448 | 76b10f1de93af4a6baf1e54a53f0a23aa7443f5cafbe3df1ccb2ccce8a6b5edd |
| handoff-inbox.int.test.ts | 17295 | 00fbb86009e76c6188dc7aa13f7fbb2a17656e026fe06a3f861987407e95f995 |
| turno/handoff.ts | 7338 | 1ea4d7187ef04ec707e61fbc1ed460c37003f85d1640a47fe2cdbfbcdd38d2f6 |
| whatsapp/visibilidade-lead.ts | 1098 | 6bca255bc36ad8e07ea0d11c6ff61642a0c771fc7e5c9d2f8161cfa5baaf7a31 |
| lib/labels.ts | 32426 | 3661b5312b63aff7c782ade2bcd934182b16763216b6ebfbb70e1d1a70aaefa8 |

## Limites e entrega

Notas do atendimento seguem E0: convidado autorizado recebe resumo, sem nova alçada comercial. Campos e tarefas sem leitura atual ficam genéricos, preservando as ações. APROVADA/EXECUTADA não é recibo externo; criadoEm <= pedidoEm é o critério literal. A resposta de transição do executor real integra feito; não foi excluída para reproduzir o exemplo histórico de duas ações.

Sem preview, UI nova, corpus visual, mensagem externa ou mudança de fuso. Intenções de teste são fixtures descartáveis, sem despacho. Visual novo é N/A. Os negativos da #349 e as provas da #423 permanecem nominais às respectivas fontes, sem reclassificação.

O banco foi liberado ao ROOT após o último terminal; nenhuma nova operação DB está autorizada ao DEV. Restauro ROOT 491, QA independente, revisão, CI e publicação ainda serão registrados pelo integrador. A issue não está concluída nesta entrega.


### Constância final do banco — #351

ROOT confirmou restauro do ciint491 na sessão 362469, EXIT0: 424 hashes conferidos, fixture e snapshot preservados, zero outras atividades. Nenhuma nova operação DB pelo DEV. Fonte funcional 55d9c5eb159649f73a35686183fa81d5400304b5 preservada; este adendo é exclusivamente documental. QA independente, revisão, CI e publicação seguem pendentes.


### Composição sobre349 corrigida e expectativas completas
A fontef95688f7 incorpora34923fb eMain170edbad;12SRC351 são byteiguais aoDEV/QA6fe. Um13ºpath de teste acrescenta somente handoff:null a quatro expectativas completas, mantendo os nove toEqual. RED completo1124/3d2992:11passes/2falhas em13,saída1; GREEN completo49233/22d738:13/13,76,35s,saída0,um worker,sem filtro/skips. RestauroROOT98878/db4b5d terminou0:424hashes/1378registros/sequências preservados. QA independente nominal:7/235UNIT e3/34INT,lint12;restauroTESTER55a5ff. [Evidências e limites](inbox-351-qa/indice.json). UNITglobal/TSCoriginal da composição em curso;CI/revisão final/publicação/merge pendentes. Não concluir351 e não somar recortes.


### Gates originais da fonte integrada e899cef2
ROOT aprovou a regressão UNIT global:941arquivos/7.483testes,448,67s,doisworkers,sem filtro/skips na configuração unitária que excluiINT (sessão53058/terminalc68959,saída0). TypeScript ORIGINAL sem exclusões/incremental,heap8192MB:85065/e8c411,saída0. Lint GLOBAL43255/98c001,saída0,zero erros/40avisos herdados. Os13SRC do manifesto foram conferidos no commit e899cef25252452614a73b46303c444c8ba8e51e:12iguais aoDEV6fe e fixture adicional com4defaults completos. Nenhuma fonte mudou durante os gates. A dependência349 ainda aguarda integração completa/merge;CI/full351 e revisão final continuam separadas.


### Dependência349 integrada em main
A PR424 foi mergeada em7c880a81eedea7d6c9fc4167b8d7bad310c63586. A composição351 incorpora essaMain, preservando toda a árvore executávelf99fa9a7:os conflitos de squash foram resolvidos mantendo os quatro arquivos351 já testados e a documentação349 atual. O quadroMain permanece integral, com o bloco351 unido. [Identidade](inbox-351-qa/composicao-main349.json). Não houve mudança de função/ACL/schema/dependência nem repetição dos gates de código. Full35140145615424 segue nominalf99 e está emcurso;CI final será conferida após retarget paraMain.


### Integração completa351 aprovada
A execução40145615424 terminou com quatro shards aprovados:351arquivos/3.144testes;trêsarquivos/quatrotestes opt-in ignorados, declarados à parte. Fontef99fa9a7;watch40858/6d61da e conferência92067/5de763,ambosEXIT0. [Prova dos jobs](inbox-351-qa/ci-full-f99.json). A composição comMain7c88 preserva toda a árvore executável dessa fonte;este registro não muda código. A PR será retarget paraMain e a CI final/revisão serão conferidas antes do merge.
