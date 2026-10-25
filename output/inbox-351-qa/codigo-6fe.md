# QA independente #351 — resumo autorizado do handoff

Parecer favorável ao recorte solicitado no commit exato6fe007f3baa860c8eb0fff8b5ee523e08d1ac24e, fonte executável55d9c5eb159649f73a35686183fa81d5400304b5, baseb292bf791e2a4762f892a68bba87a9de5f407b5f. Entrega aditiva do DTO/loader, sem nova interface352, ação Assumir, envio ou alçada354–358. A publicação depende da #349; sua correção de defaults e seus negativos permanecem separados. Não declaro regressão global, TSC original ou CI final executados por mim.

## Ambiente e execução própria

Worktree exclusivo inbox-tester, branch codex/inbox-e3-351-qa, perfil tester e banco descartável TESTER491. READY ROOTfcafd0 EXIT0 confirmou cliente próprio490, snapshot1.392/424hashes f1d15dff e lease exclusiva. Préflight218fd7 confirmou HEAD/perfil/tracked limpo; leitura física a56ca6 confirmou cliente SHA647c2586589198b10c9345265e0cce7a43819d5cb44633dbad5e0e0b611fae2b. Não instalei, gerei cliente, executei DDL ou alterei schema/perfil/cluster. Não houve browser, HTTP de produto, nota manual ou integração externa.

Node22 local: C:/Users/Mendes/AppData/Local/hermes/node/node.exe. Comandos executados no próprio worktree, fonte congelada até os terminais:

~~~text
node node_modules/vitest/vitest.mjs run src/server/aria/handoff-inbox.test.ts src/server/aria/turno/handoff.test.ts src/lib/labels.test.ts src/app/enums-rotulos.test.ts src/server/whatsapp/visibilidade-lead-db.test.ts 'src/app/(app)/inbox/PainelAtendimento.aria.test.ts' src/server/inbox/permissoes.test.ts --maxWorkers=2
node node_modules/vitest/vitest.mjs run src/server/aria/handoff-inbox.int.test.ts src/server/whatsapp/consultas-inbox.aria.int.test.ts src/server/whatsapp/nota-interna.int.test.ts --config vitest.integration.config.ts --maxWorkers=1
node node_modules/eslint/bin/eslint.js <12 SRC/testes de git diff b292bf79 HEAD -- src> --max-warnings=0
~~~

UNIT: sessão41035/início682c8f/terminal8f32b8 EXIT0, sete arquivos completos/235testes,30,72s,w2,sem filtro/skips. INT: sessão11991/início262494/terminal65d9c9 EXIT0, três arquivos completos/34testes,144,89s,w1,sem filtro/skips. Incluí nota-interna pela regressão E0 e compatibilidade do helper/reexport; não repeti os cinco INT DEV. Lint12: fbe2f5 EXIT0,sem avisos permitidos. As advertências de configuração vite-tsconfig-paths e MIXED_EXPORTS na integração não foram falhas de teste. Os recortes não são somados com DEV ou tomados como suíte global.

A mesma sessão INT foi acompanhada até o terminal. Liberei explicitamente TESTER491 ao ROOT logo após65d9c9; não realizei operação DB posterior. Restauro posterior é prova separada do integrador, não presumida aqui. A sessão estática9993 não usou DB.

## Leitura adversarial e oráculos relevantes

carregarAriaDoAtendimento consulta o atendimento no escopo autorizado antes de chamar o loader. O loader interno recebe esse alvo do servidor e o mesmo Db; não é API para identidade arbitrária do cliente. Pendência usa idsHandoffPendente da #342 restrito ao ID, sem duplicar sua regra. A fonte é a última HANDOFF EXECUTADA por criadoEmDESC/idDESC; SIMULADA/BLOQUEADA são excluídas. HUMANO/CELULAR/AtendimentoAssumido só encerram quando estritamente posteriores; encerramento e ausência de fonte retornam null. Empate de ID é desempate determinístico, não prova causal.

Resumo vem da nota da HANDOFF selecionada. E0 permite o resumo do atendimento a todo leitor vigente autorizado, inclusive convidado sem contatos.ver/carteira. Isso não concede outro lead ou escrita. O wrapper testado nega não convidado, convite expirado e revogado, e preserva outra via legítima de gerente. O helper contextual só acrescenta o lead do próprio atendimento autorizado; ações explicitamente vinculadas a outro lead fora do escopo são excluídas. Ler o resumo não usa decidirHistorico como gate.

feito seleciona as dez ações EXECUTADA/APROVADA mais recentes, exceto HANDOFF, com criadoEm<=pedidoEm. Lê páginas keyset100 em DESC(criadoEm,id), autoriza oportunidades em lote por página e continua até dez ou EOF; não há truncamento200 nem consulta por item. Reverte a seleção para apresentação ASC(criadoEm,id). O caso com201 ações recentes negadas e15 autorizadas empatadas mais antigas exige as dez corretas em ordem, sem vazamento e com limite de chamadas de autorização por página. SUGERIDA/DESFEITA e ação posterior ao pedido ficam fora. O teste do executor real inclui sua resposta de transição pelo mesmo predicado, sem excluir um item para reproduzir exemplo histórico.

Sem alvo/contexto autorizado, descrições com dados ficam genéricas. Campo personalizado requer contatos.ver e contexto autorizado; caso contrário mantém “Preencheu um campo”. Tarefa requer tarefas.ver, ID persistido em payload.tarefaId e leitura atual em escopoTarefas(minhas/fila/equipe), em um único lote; ID ausente/inexistente/fora do escopo mantém “Criou uma tarefa”. O payload não é serializado no DTO; feito só contém texto/quando. 0 e false são preservados, objetos/enum inválido/títulos inválidos não são renderizados como dado. Resposta/documento/agendamento/nota/condição/setor usam frases fixas. Estado da ação não é recibo de entrega externa nem criadoEm uma data de aprovação.

Todos os leitores efetivos usam o Db recebido: pendência, HANDOFF, escopo comercial, participantes, oportunidades, nome histórico e tarefas. escopoTarefas apenas constrói o where; a consulta real é db.tarefa.findMany. Não há conexão global interna ou transação nova nesse loader. O cenário pool1 cria na mesma tx usuário/nome, tarefa, carteira, nota e ações não commitados, exige os valores esperados e lança ROLLBACK_351; depois comprova ausência de tarefa/usuário/ação. Uma leitura global nessas etapas não veria a fixture e falharia. Isso não promete snapshot universal sob READ COMMITTED.

podeAssumir é apenas capacidade atual de fila/linha, sem chamar ação; ehResponsavel usa responsável atual da conversa representado no atendimento, não dono comercial como atalho. Linha de outro e responsabilidade já atribuída não ganham Assumir. UI/fluxo de assumir continua fora351.

## Parser, motivos e compatibilidade

lerNotaResumo usa os rótulos canônicos Motivo/Resumo/Próximo passo e aceita subconjuntos em ordem, CRLF/CR normalizados e continuações, preservando quebras internas e trim nas bordas. Preâmbulo inclusive vazio/branco, duplicatas e ordem regressiva retornam objeto vazio. Nenhum limite de nota manual foi imposto. O legado não escapa conteúdo que imita rótulo posterior: essa ambiguidade permanece documentada/testada, sem promessa de inversão arbitrária.

Os13 textos anteriores do Playground são literais no mapa central MOTIVO_HANDOFF_LABEL, com apenas Turno interrompido adicional. Object.hasOwn evita constructor/__proto__/motivo desconhecido; o DTO responde motivo null e frase fixa sem ecoar código. Destino inválido vira FILA_SETOR; nome/nota ausentes permanecem null. O tipo de sistema não muda o schema de saída do modelo. O Playground usa o mapa preservando layout/textos conhecidos; fallback desconhecido agora é genérico seguro.

A guarda de mapas recebeu uma entrada exata arquivo/nome para a descrição contextual switch acao e registro do mapa central. Minhas comparações AST confirmam as19 funções do classificador literais; não houve regra frouxa ou exceção por prefixo. Cinco literais cliente e três expectativas completas do servidor mudaram somente handoff:null; removê-lo recompõe os arquivos anteriores byte a byte. O UNIT do Painel preserva asserções/driver, sem antecipar consumidor novo.

## Identidades e evidências

Verificador próprio verificar-inbox-351-identidade-tester.mjs, sessão9993/terminalf2dfdc EXIT0:15paths totais,12SRC/testes; formatter montarNotaResumo e executarHandoff literais;11outras funções de consultas literais;13paths protegidos #349/decoder/histórico/#342/uso/executor/tarefas/schema/package/lock iguais à base. Scripts/harness/workflows também sem delta. Recibo final DEV dos15blobs conferido por Git e normalização física do próprio checkout. O relatório documental6fe não muda o produto55d9.

Precisão da extração: a FUNÇÃO completa podeVerLeadNaThread(export+assinatura+corpo) tem633bytesLF/SHAe68b8aee4fdfa9c6934fb7c378a1357c60c2b55eeb66e06615b914fbedabb4c7 e é literal da base para o novo módulo; import/reexport anterior compatível. O body AST isolado tem478bytes/SHA71be0e918cc662c826a48f64a023c30acb3c714fbbd88349e8d7f96c17cf700b. Meu primeiro verificador confundiu a métrica e falhou b67a86; preservei-o em verificar-inbox-351-identidade-body-metrica-negativo-tester.mjs e corrigi apenas a métrica após leituraf85521. Nenhuma fonte ou teste de produto mudou. ROOT confirmou a mesma distinção.

- output/inbox-351-unit-tester.log: 485 bytes/SHA6463418a50ce3f2636d8577bca895bdc91bddfb789fb051545e09a853d602a51.
- output/inbox-351-int-tester.log: 812 bytes/SHAca011e18ea4e27cc62bc896be6b5ed445296ef61f88369452cc81b2c47349558.
- output/inbox-351-lint-tester.log: 0 bytes/SHAe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.
- output/inbox-351-identidade-tester.json: 8539 bytes/SHA5e7ea93adfa32985f815d6f91b4ba08e991b1effbacc2e65fe9c0316afb1878b.

Sessões e contagens: inbox-351-gates-tester.json. HEAD/tracked continuaram limpos ao fechar este parecer. Os resultados DEV29/420,cincoINT/68 e último handoff16 separado, TSC auxiliar e negativos TDD/guardas/resultado-coluna são históricos DEV preservados, não novos gates meus nem comando único84. Não repeti TSC auxiliar/global; TSC original e CI da composição/publicação serão tratados pelo ROOT. A #349 ainda depende de sua correção separada de defaults completos e integração; isso não é erro de orçamento, não foi misturado nesta fonte nem ocultado pelo recorte351. Visual novo N/A ao produtor/refatoração existente, sem screenshot/aceite UI presumido. Nenhuma publicação, merge ou conclusão351 é afirmada.
