# #305 — Chevron fora do texto e menu dentro da viewport

Estado em 22/10/2026: implementação, recortes e gates globais aprovados no Node22.23.2; **aguarda TESTER e capturas visuais coordenadas**. Branch `codex/inbox-e0-305` iniciada em #303 congelada `79a905a2ffe4e34a905f174b416ed2982601d9a1` e rebaseada por coordenação sobre #303 final `37914e4a5d970bbf15e36f660e8aa2750ba79ffe` (PR#384), worktree exclusivo DEV A, perfil `dev-email`. Planejamento prévio preservado em `output/inbox-305-plan.md`.

## SPEC e implementação

O gatilho fica antes do autor/conteúdo, com float-right, para reservar espaço na primeira linha. O balão é group; gatilho fechado aparece em hover/foco e em dispositivo sem hover, permanecendo visível com menu aberto. Props existentes, incluindo menuAberto para SSR, autores, comandos, capacidades, mídia, enquete e Pix, continuam compatíveis.

O painel é fixed na viewport, escondido até medição por layout effect e cálculo com `posicaoPopover`. Só então o primeiro habilitado recebe foco com preventScroll. `aria-controls` liga gatilho e painel. Fechar anula posição; reabrir mede novamente. Mudança de ordem/texto/comandos/capacidades com o menu aberto também recalcula dimensão/posição e foca habilitado. Itens sem capacidade continuam disabled e não executam comando.

Reutilizados `ligarMenuAberto`, `posicaoPopover`, `CLASSE_PAINEL_MENU` e `CLASSE_ITEM_MENU` sem mudar helpers globais. Escape em captura fecha só o menu e devolve foco; setas/Home/End percorrem habilitados; Tab fecha sem bloquear navegação/retornar foco. Clique fora, rolagem externa em captura e resize fecham; a limpeza remove ouvintes. Escolha de comando fecha, devolve foco ao gatilho e entrega exatamente o comando existente, permitindo ao chamador abrir seu diálogo.

Ruling: `posicaoPopover` ajusta coordenadas, mas não reduz dimensões; portanto o painel local limita maxHeight a calc(100dvh - 16px) e usa overflowY auto **antes da medição**. Isso mantém o menu inteiro na área útil em viewport curta; rolagem interna não o fecha. Não houve expansão do contrato global do posicionador.

Nenhuma alteração de servidor, envio/transportes, schema, permissão ou package/lockfile. Nenhum processo de servidor ou banco foi iniciado. Captura visual continua necessária para validar fluxo real/CSS, principalmente toque, float e bordas.

## TDD e testes dirigidos

Todos os comandos novos desta issue usam `C:/Users/Mendes/AppData/Local/hermes/node/node.exe` v22.23.2 já preparado, sem instalar/copiar/regenerar dependências.

- RED SSR antes do patch, `node.exe node_modules/vitest/vitest.mjs run src/components/conversa/BalaoMensagem.test.ts`: **exit 1**, 3 falhas/12 aprovados, sem ignorados (`9e852f`): posição anterior de gatilho/autor, visibilidade e painel absoluto sem limite.
- RED interação real antes do patch, `... run src/components/conversa/BalaoMensagem.interacao.test.ts`: **exit 1**, 6 falhas/3 aprovados (`289dd7` e repetição `437da4`). A primeira assertion de identidade do DOM gerava dump cíclico muito grande e avisos de key/ref ao formatar a falha; trocada por igualdade booleana, sem mexer no componente, e RED repetido legível. Falhas de medição/foco, setas, Tab, scroll externo, viewport curta e capacidade/comandos dinâmicos.
- Primeira execução após patch (`6fc05a`) falhou por limite do DOM mínimo: seletor :disabled não suportado. Adaptação **somente no teste** traduz esse pseudoseletor ao atributo equivalente para seus buttons; utilitário compartilhado/produto não alterados para contornar fixture. Após ajuste, **2 arquivos/24 testes exit 0**, sem ignorados (`02256d`).
- Recorte obrigatório ampliado: `node.exe node_modules/vitest/vitest.mjs run src/components/conversa src/app/botoes.test.ts src/app/paleta.test.ts 'src/app/(app)/inbox' src/components/Menu.test.ts src/components/Menu.interacao.test.ts src/lib/popover.test.ts`: **exit 0**, **31 arquivos/349 testes**, sem filtro de nome ou ignorados (`42354a`). Inclui trava sem-polling e as regressões dos helpers consumidos; não é suíte global/integração.
- Reforço final de clique após revogação da capacidade, sem mudar produção: balão SSR+interação **2 arquivos/24 testes exit 0** (`2b56f7`).
- `git diff --check`: **exit 0**, `6dfd9a`; apenas avisos Git LF/CRLF, sem erros de whitespace.
- Lint dirigido dos três arquivos TS/TSX do balão: `node.exe node_modules/eslint/bin/eslint.js src/components/conversa/BalaoMensagem.tsx src/components/conversa/BalaoMensagem.test.ts src/components/conversa/BalaoMensagem.interacao.test.ts`: **exit 0**, sem erros/avisos (`311f8d`). Nenhum novo disable de lint.

A interação monta **BalaoMensagem com React DOM/hooks reais** e entrega os cliques aos ouvintes delegados do container; teclado/eventos chegam a document/window. Não há mock de ligarMenuAberto ou posicaoPopover. Ícones decorativos viram spans porque o DOM mínimo suporta só HTML. Geometria é controlada localmente, incluindo restrição de altura, e não equivale a medição CSS de navegador. Cobertura: limites inferior/direito e curta, medição escondida/foco visível preventScroll, teclas/disabled, Escape sem diálogo pai, Tab, scroll interno/externo, resize, reabertura, capacidades/comandos atualizados, clique habilitado/desabilitado, clique fora, menu sem habilitados e desmontagem/limpeza. Nenhum comando de negócio ou transporte é executado; callback é somente fixture de teste.

As execuções acima terminaram diretamente com exit code final, sem session_id pendente ou processo desacoplado. Aviso preexistente de vite-tsconfig-paths permanece. A responsabilidade de layout/hover/toque real fica no aceite visual, não presumida pelo teste controlado.

## Pendências

Janela global liberada pelo integrador foi utilizada conforme evidências abaixo. TESTER no SHA exato. Capturas antes/depois coordenadas em1440×900,1024×768,390×844, claro/escuro: primeira linha curta com/sem autor, entrada/saída, menu perto das bordas, foco/toque e painel alto com avisos. Sem envio externo. Integrador publica PR por issue; sem push/PR/merge/deploy neste papel. Não declarar #305 concluída antes desses gates.

Rebase anterior aos globals: conflito somente no quadro, resolvido preservando #302/#303 finais e acrescentando #305. Fonte e testes da feature não foram alterados pelo rebase.

## Gates globais próprios no código `4c2424ab0df7465212cb1927d049517162232901`

Executados após rebase documental sobre `37914e4a`, usando `C:/Users/Mendes/AppData/Local/hermes/node/node.exe` v22.23.2, sem instalar/regenerar dependências. A limitação a dois workers foi determinada pelo integrador para preservar recursos enquanto DEV B diagnosticava integração isolada; não é filtro de arquivos/testes.

- `NODE_OPTIONS=--max-old-space-size=8192 node.exe node_modules/typescript/bin/tsc --noEmit`: **exit 0**, sessão `54239`, conclusão `5e99cf`.
- `node.exe node_modules/vitest/vitest.mjs run --maxWorkers=2 --reporter=json --outputFile=output/inbox-305-unitarias.json`: **exit 0**, sessão `18026`, conclusão `0415be`. JSON conferido em `ec2447`: **842 arquivos, 6.500 testes aprovados, zero falhas, pendentes ou todo**, sem filtro de nome. É a suíte unitária completa configurada; integração `*.int.test.ts` permanece excluída pela configuração normal. JSON somente local, fora do commit. Sessão acompanhada durante todo o período sem saída intermediária do reporter, sem processo desacoplado/interrupção.
- `node.exe node_modules/eslint/bin/eslint.js . --max-warnings 40`: **exit 0**, sessão `81037`, conclusão `b00e05`, **zero erros e 40 avisos preexistentes**, sem exclusões adicionais. Nenhum aviso acrescentado pela feature.
- `git diff 37914e4a5d970bbf15e36f660e8aa2750ba79ffe HEAD --check`: **exit 0**, `ec2447`.

Todos os processos encerrados com saída terminal observada. A consolidação posterior altera somente relatório/quadro, sem mudar fonte/testes nem repetir gates. TESTER e capturas visuais coordenadas seguem pendentes; nenhuma outra issue será iniciada antes do fechamento integrado E0.
