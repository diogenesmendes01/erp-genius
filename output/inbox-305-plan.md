# Investigação/plano preparado — #305

Documento histórico da preparação, anterior à autorização de implementação. Execução e evidências atuais: `output/inbox-305-report.md`.

22/10/2026. Somente leitura de fontes e escrita deste documento local; nenhuma branch ou alteração de código/teste, servidor ou instalação. Worktree DEV A continua `codex/inbox-e0-303`, HEAD `79a905a2ffe4e34a905f174b416ed2982601d9a1`. Implementação depende da liberação do integrador após revisão #303.

## Diagnóstico confirmado

`BalaoMensagem.tsx` mantém gatilho absoluto após conteúdo e menu absoluto relativo ao balão. Efeito próprio cobre apenas clique fora/Escape, sem devolver foco ou tratar setas/Tab/scroll/resize. As props atuais já contêm autor/participante, `menuAberto` inicial, filtro `comandos`, capacidades, mídia/Pix/enquete; devem permanecer compatíveis.

`Menu.tsx` fornece `ligarMenuAberto`, incluindo teclado em captura (Escape para só o menu, antes do diálogo pai), retorno de foco via callback, Tab sem retornar, setas/Home/End só entre habilitados, clique fora, scroll externo em captura e resize. Scroll do próprio painel é ignorado. O padrão mede âncora/painel por layout effect, calcula posição com `posicaoPopover`, deixa painel hidden até posicionar e só depois foca o primeiro habilitado com preventScroll. A limpeza remove todos os ouvintes.

`posicaoPopover` tem margens8px e distância6px, abre acima quando cabe melhor e limita coordenadas horizontais/verticais. Não limita as dimensões: um painel mais alto que a viewport continua transbordando mesmo com topo8. `VirtualList` usa top absoluto nas linhas, sem transform; portanto não cria bloco transformado que prenda position:fixed. ConversaAberta está no corpo do Inbox, e o Drawer do Inbox contém o painel lateral, não os balões. Confirmar geometria real nas capturas.

## Execução quando liberada

1. Criar branch própria no SHA final indicado pelo integrador, preservando #303 congelada. RED no `BalaoMensagem.test.ts`: gatilho antes de autor/texto com float-right; classes hover/foco/toque e menu aberto; painel fixo mantendo markup via menuAberto. Preservar comandos/avisos/autor/mídia/Pix/enquete e os testes existentes.
2. Acrescentar interação antes do patch: abrir na borda inferior/direita, medir painel oculto e focar primeiro habilitado após posicionar; setas/Home/End ignoram disabled; Escape fecha e devolve foco; Tab, clique fora, scroll externo e resize fecham sem roubar foco. Clique num comando chama comando correto e fecha; reabrir recalcula posição; desmontagem remove ouvintes. Evitar testes que apenas buscam nomes de helper na fonte.
3. Aplicar o padrão de Menu localmente no balão, reaproveitando ligarMenuAberto/posicaoPopover/classes. Gatilho antes do autor, float-right e estado visual conforme task; refs próprias, posição anulada ao fechar, foco preventScroll depois da medição. Não alterar os helpers compartilhados se o problema for resolvível no balão.
4. Painel alto: provar com viewport curta e menu completo/avisos de motor. Se exceder altura útil, limitar a altura local do painel e permitir scroll interno antes de medir, para cumprir o objetivo de ficar dentro da tela. Não ampliar posicaoPopover global incidentalmente. Testar que scroll interno continua permitido, mas rolagem da conversa fecha o menu.
5. GREEN recorte obrigatório Node22.23.2: conversa inteira + botoes + paleta + Inbox; acrescentar Menu.test/Menu.interacao e popover.test como regressão do contrato consumido. Lint dirigido cedo para não acrescentar avisos à baseline40; TSC/full/lint global na janela reservada e sessões observadas. Diff-check0. SPEC e quadro com limites reais, commit por issue/trailer e SHA para TESTER.
6. Capturas coordenadas antes/depois, 1440×900,1024×768,390×844, claro/escuro: primeira linha curta com/sem autor, entrada/saída, menu na borda inferior/direita, toque/foco e painel alto com avisos. Sem envio externo; texto/copiar e ações simuladas apenas quando autorizado. Visual não é comprovado pelo DOM mínimo.

## Riscos concretos para testes e aceite

- Medir/focar enquanto visibility:hidden não funciona: foco somente após posição definida, sem provocar scroll que fecharia o menu imediatamente.
- O DOM mínimo existente não tem SVG namespace nem despacho de eventos; um teste de componente real precisará de adaptação restrita ao teste (ícones decorativos sem influência no comportamento e alvo de eventos controlado), ou de harness de navegador local. Não expandir utilitário global sem necessidade; testes de ligarMenuAberto já cobrem helper, mas não provam a ligação no balão.
- Quando capacidades/comandos mudam com menu aberto, a altura/número de itens pode mudar. Avaliar dependências de medição e manter foco em habilitado; teste específico deve guiar a solução mínima.
- React lint: copiar o padrão de medição de Menu com useLayoutEffect, validando cedo que baseline não aumenta; evitar resets síncronos de estado em efeitos sem necessidade.
- Menus vazios/todos disabled não têm primeiro habilitado; Escape/fechar continuam seguros.

## Evidências desta investigação

Task integral #305 lida de `output/inbox-issues-20261022.json` do integrador; riscos anteriores de `output/inbox-dev-a-investigacao.md`. Lidos BalaoMensagem/TEST, Menu/TEST/Menu.interacao, popover/TEST, VirtualList, ConversaAberta, InboxNovo e Drawer. Nenhum teste executado nesta investigação, nenhuma alteração de código/branch. Novos gates ainda não existem para #305.
