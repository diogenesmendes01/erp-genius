# PR382 — correção B1

O cliente consultava apenas selecionadoRef e visibilityState, sem verificar se o CSS escondia a thread ao Voltar no celular. Agora a região da conversa tem ref e sua geometria real condiciona leitura por aviso e zero otimista da consulta. O marcador aceita predicado opcional para descartar repetição pendente quando a região/aba deixa de estar visível ou muda a seleção. Nenhum breakpoint duplicado, alteração de servidor, permissão ou polling.

TDD Node22.23.2: RED1628bb exit1,3falhas/21passes para Voltar, painel e repetição oculta; GREENb271e9 exit0,2arquivos26testes. RED766ce7 exit1,1falha/24passes para aba oculta durante repetição. Depois da correção, suíte unitária completa70638 exit0:840arquivos6483testes,semfiltros/ignorados,maxWorkers2. TSC80712heap8192exit0; lintdirigido3fontes98579aexit0.

Navegador25181 exit0, Chrome local e **SSE real** em localhost3112, banco exclusivo ci-integracao/erp_genius_test_ciint. 390px: depois de Voltar e inserir ENTRADA fictícia, chamadas de leitura1→1, contador1 e lidaAte preservado. Reabrir marca0. Ao alargar para700px com vista lista retida, a região reaparece e a nova entrada é lida normalmente. JSON em ui.json; screenshots locais de apoio fora do commit. O servidor mostrou warnings de keys duplicadas preexistentes na base, cobertos pela PR390; não se alega console totalmente limpo. Nenhum pageerror observado.

Preview32568 encerrado porCtrlC/exit1 APÓS prova; bloco Next gerado emAGENTS restaurado. Helpers de preparação/banco/browser e credenciais fictícias não versionados. Banco criado/migrations485 aplicadas somente no perfil fechado autorizado; nenhum outro banco/cluster/integrador alterado.

**Parcial:** resolve somente B1. C1visibilitychange,C2revalidateduplicada,C3integraçõesheadfinal e C5CI ainda pendentes. Não é parecer APPROVE nem fechamento da PR.
