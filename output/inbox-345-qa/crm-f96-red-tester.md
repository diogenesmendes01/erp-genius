# Investigação FS e RED causal — executorCRM / #345 em f96

Conclusão: os dois casos antigos confundem aviso de refresh da ação com execução efetiva da nota. A fonte345 exige refresh por IDs após INSERT de AcaoAgenteIA com atendimento, inclusive SUGERIDA/SIMULADA. Recomendo corrigir somente expectativas/nome do teste e reforçar ausência de efeitos; não alterar runtime ou filtrar avisos para esconder o resultado.

Fonte por objetos Git: f96cb2cbf4c9497baf6e030d1d106a8254cfb3b1. Caminho real src/server/aria/turno/executor-crm.int.test.ts; a primeira tentativa administrativa usou aria/ sem turno/,não encontrou o arquivo e não executou teste. As seis fontes e OIDs foram registradas em output/inbox-345-executor-crm-f96-estatica-identidades-tester.json,terminal9e35c9 EXIT0,antes do preparoDB.

## Causa demonstrada por fonte

executarAcaoCrm cria a linha SIMULADA para SHADOW ou SUGERIDA para destinoSUGERIR e retorna ANTES de aplicarAcao. O ramo NOTA_INTERNA de aplicarAcao é que registra EventoNotaInterna e envia o aviso manual do atendimento. Nenhuma nota efetiva é criada nos dois earlyreturns.

Migration20261025020000_inbox_aria_tempo_real cria AFTER INSERT OR UPDATE OFstatus em AcaoAgenteIA. Apenas atendimentoIdnull é ignorado noINSERT; statusigual é ignorado noUPDATE. Não há filtro que exclua SIMULADA/SUGERIDA. O pg_notify contém exatamente tipoatendimento.atualizado/atendimentoId/mensagemIdnull/conversaId e só é entregue em commit. Esse é o refresh da sugestão/estado, não o conteúdo ou execução de uma nota.

AvisoInbox/eventosSSE mantêm esse contrato de IDs; o filtro de escopo continua responsável por quem recebe. O helper real comAvisosInbox abre LISTEN antes da operação e usa canal privado de barreira depois, sem inserir aviso falso no canal do Inbox ou depender de sleeps. Não proponho mudar esse isolamento.

## RED próprio autorizado e separado

ROOT preparou HEADf96/branchQA/perfiltester/client490/tester492,snapshot1393/424hashes e lease exclusiva. Comando:

    Node22 --max-old-space-size=512 node_modules/vitest/vitest.mjs run src/server/aria/turno/executor-crm.int.test.ts --config vitest.integration.config.ts --maxWorkers=1 -t 'nota (SUGERIR|SHADOW)'

Sessão41047/start026512, terminal650c8a EXIT1:28coletados,2casos executados/2falhas causais,26skipped pelo filtro,42,80s(testes19,70s). Sem timeout alterado/filtro oculto. Os dois checks de status SUGERIDA/SIMULADA passaram; falha ocorreu na linha175, [] versus um objeto exato de quatro campos, com atendimento/conversa corretos e mensagemIdnull. Os asserts posteriores de NotaInternacount não foram alcançados nesse RED. Não chamar este recorte de arquivo completo ou aprovação.

A FULL40161155167/job121073179359 com três shardsSUCCESS e duas falhas no quarto é evidência informada pelo ROOT; não a consultei nem reexecutei por conta própria. O RED local confirmou o sintoma relevante com a fonte exata.

## Atualização mínima recomendada — ainda não aplicada pelo TESTER

Renomear os dois casos parametrizados para distinguir refresh da ação de nota efetiva. Substituir somente [] por igualdade EXATA de array contendo um aviso:

    expect(avisos).toEqual([{tipo:'atendimento.atualizado', atendimentoId:c.at.id, conversaId:c.at.conversaId, mensagemId:null}]);

Não usar arrayContaining,filter por tipo,>=1 ou remover a igualdade fechada. Manter o status e NotaInternacount0. Acrescentar intencaoMensagem0 e MensagemWhatsAppSAIDA0 (ou comparação com baseline das mensagens), bem como eventoId/intencaoIdnull no resultado e ausência do texto da nota na serialização dos avisos. Como o cenário já contém uma mensagemENTRADA, não exigir count de TODAS mensagens=0.

Preservar o casoEXECUTAR positivo: EventoNotaInterna com autor/contexto/payload correto, nenhuma intenção de envio e aviso por IDs sem texto. Não exigir exatamente dois avisos nesse caminho: trigger e aviso manual podem ser idênticos/coalescidos na mesmaTX; não há contrato universal de dois eventos separados.

Preservar o rollback existente com avisos[] e NotaInternacount0. Ele é o contrafactual de ausência de commit: o INSERT da ação e eventual aviso manual da nota não podem vazar após rollback. Os casos transacionais345 já cobrem commit/rollback/no-op/status; não é necessário redesenhar runtime, mocks ou permissões para estes dois legados.

## Próxima prova e limites

Depois do commit exclusivo do teste pelo ROOT, executar o arquivo executorCRM COMPLETO e o arquivo completo barramento26, w1/mesmaDBexclusiva, seguindo as sessões até terminal. O GREEN deve comprovar tanto a expectativa nova como os asserts de não execução; não inferir verde somente da análiseFS/RED. Não iniciar nada antes do SHA/preparoGO.

O RED usou DML do cenário/truncagem autorizado pela suíte, sem DML manual/DDL/install/provider/browser/HTTPexterno. Ao terminar650c8a, nenhum executor ficou ativo; lease foi explicitamente mantida emHOLD para a próxima coordenaçãoROOT, não liberada/restaurada pelo TESTER. Fonte/privados328/350 preservados. Nenhuma fonte de outro checkout foi editada.
