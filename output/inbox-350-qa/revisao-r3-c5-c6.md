# Revisão R3 — C5 e C6

C5: as duas transcrições públicas de QA usam `node` em lugar do caminho absoluto do executável local. Somente esse trecho foi sanitizado. Os originais privados continuam preservados, e `indice.json` registra separadamente seus hashes históricos e os hashes das cópias atuais. Não se atribui nova execução ao TESTER.

C6: mantido o limite pelas mensagens. `ConversaAberta` primeiro chama `itensDaThread`, que, quando `temMaisDepois=true`, exclui as notas posteriores à maior mensagem da janela. Só então intercala sugestões com o limite superior. Portanto, uma nota posterior não pertence à janela visível nesse estado. Usar o máximo das notas brutas ampliaria a janela justamente para sugestões que devem aguardar a próxima carga.

Exemplo: mensagem às 10h, sugestão às 11h e nota às 12h. Na janela antiga, tanto a sugestão quanto a nota ficam fora; na janela atual ambas podem aparecer. Os contratos estão exercitados em `ConversaAberta.test.ts` (nota posterior e sugestão futura) e `itens-thread.test.ts` (nota posterior e duas bordas, incluindo itens nos limites). A premissa da observação C6 não justifica mudar o contrato de paginação. Não houve alteração de runtime para este comentário.

B1/C2 continuam pendentes da composição com #420/#427, preservando os dois blocos de testes e os históricos do quadro. C1 continua aguardando a autorização já solicitada para os anexos. Nenhum merge é declarado pronto.

Verificação própria ROOT sobre o runtime84e: três arquivos completos (`ConversaAberta.test.ts`, `aria/intercalar.test.ts`, `itens-thread.test.ts`), 65 testes aprovados, heap512/w1, sem filtros ou skips, terminal7a1c3c EXIT0. A primeira tentativa7b542b falhou antes de executar testes por EPERM no rename do cache temporário do Vitest; a repetição autorizada com acesso ao cache terminou0. Não houve alteração de configuração, aumento de timeout, DB ou captura. O parecer estático do TESTER sobre o ajuste de tipos84e foi lido integralmente nesta rodada; não se atribui este recorte ao TESTER.
