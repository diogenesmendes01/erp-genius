# QA independente #394 — conciliação isolada 4696b422f710ae07b60e10e1eceb8f8fa5328aec

Parecer favorável ao SHA exato, no escopo da fila C1 sobre a casca anterior à #313. Não é homologação da composição moderna nem do browser.

A fila `atualizar-lista-em-lote.ts` tem objeto idêntico ao fix isolado b2338414: janela fixa de 50 ms, um voo até o corpo HTTP, uma pendência consolidada e cancelamento por contexto real. O effect de filtros equivalentes chama `invalidarSnapshotEmVoo` antes de incrementar `aplicada`, garantindo GET fresco trailing sem reabilitar A→B→A. No consumidor, início de GET captura versão da leitura e das entradas; GET fresco na mesma versão pode corrigir zero, GET anterior ao SSE não apaga entrada posterior, GET anterior à falha não apaga restauração. O marcador suspende repetição quando aba/região está oculta, enquanto os IDs pendentes permitem tentar ao retornar.

Inspecionei especificamente os três testes alterados de GET antigo: cada um avança a janela de 50 ms e confirma o início do voo antes de seleção/leitura/SSE subsequente, sem mudar os valores finais esperados. O teste de falha exige uma consulta antiga mais uma recuperação serial, não duas respostas concorrentes.

Verificação própria Node 22.23.2: recorte oficial de helper, InboxNovo interação/unidade, marcador e useEventosInbox: executor a64cf8, 5 arquivos/86 testes, exit 0, sem filtro nem skips. Harness privado R6+P2 copiado do porte moderno, adaptando somente `ColunaConversas`→`ListaAtendimentos`, observação do estado de contagens e `aoAlternarPainel`→`aoAbrirPainel`: primeira execução 791466 teve 39 pass/1 erro de prop incompatível, sem falha semântica; execução final 1b8747, 40/40 exit 0. Cronologias e asserts de contagem/GET foram mantidos, inclusive P2 SSR equivalente durante body e zero fresco. Arquivos privados: `output/inbox-394-r6-isolated-private.test.ts` e config correspondente.

Não executei DB, browser, integração ou suíte global. Os gates do outro chat não são minhas execuções. O probe privado #316 continua não executado e fora deste parecer.
