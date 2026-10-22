# Inbox #308 — casca em tela cheia e painel único

## Contrato e decisões coordenadas

Base de implementação `103a507d8a8fda7a6758a4eee46177d4c3ce7a67`, branch `codex/inbox-e1-308`. Consome E0, tokens/fonte #306, harness/fixture #307 e contratos #310; preserva a lógica de leituras, contagens e SSE. A #311 altera sua própria frente e integrará depois por delta localizado. Sem schema, instalação, pacote/lock, mudança de permissão ou transporte externo.

A página mantém guarda, consultas, filtros, seleção por URL, deep link e fuso. Renderiza somente o InboxNovo dentro de uma caixa que anula o padding do main (`-m-4 md:-m-8`) e ocupa `100dvh` menos a barra mobile real:57px abaixo de sm,53px até md,0px no desktop. Sidebar global224px preservada. Não muda layout de outras rotas.

Sino e NovoAtendimento continuam funcionais até a #313: cabeçalho local da lista com sino e disclosure “Abrir atendimento” contendo o formulário real. Cabeçalho e filtros compartilham área de no máximo50% com scroll interno, deixando espaço para a lista. Nenhum campo/ação de negócio foi removido; nenhuma action foi substituída por mock na aplicação.

## Largura útil, não apenas viewport

O pseudocódigo700/1100/1200 presume rail64px do protótipo. Com Sidebar224, em768px a área útil é544px e lista300 deixaria244px para a thread. Em1200px, lista372+painel348 deixariam256px. O integrador aprovou limiares locais uniformes, painel sobreposto quando a coluna não couber e nenhuma alteração na navegação global/compositor.

Cortes finais conservadores, medidos com o compositor humano preenchido e botão Enviar:

| Viewport | Modo | Lista | Thread | Campo de mensagem | Painel automático |
| --- | --- | --- | --- | --- | --- |
|390|uma vista|oculta na conversa|390|175,28|fechado|
|768|uma vista|oculta na conversa|544|329,28|fechado|
|959|uma vista|oculta na conversa|735|520,28|fechado|
|960|duas colunas|300|436|221,28|fechado|
|1024|duas colunas|300|500|285,28|fechado|
|1100|duas colunas|372|504|289,28|fechado|
|1280|duas colunas|372|684|469,28|fechado|
|1399|duas colunas|372|803|588,28|fechado|
|1400|três colunas|372|456|241,28|348|
|1440|três colunas|372|496|281,28|348|

Abaixo de960, uma vista por vez (lista/conversa/painel); isso evita a regressão duas colunas700–767→uma após md→duas novamente. De960 até1399, painel aberto manualmente sobrepõe348px à direita, com sombra e sem véu. A partir de1400, painel vira coluna e o automático abre. Lista300 no tablet,372 a partir de1100; painel348 preservado.

Probe temporária no nó real mostrou que thread320 comporta os controles mas deixa campo105,28px;336 deixa121,28px. Os limiares escolhidos não são mínimos matemáticos: preservam margem útil (campo221/241px nos dois cortes), superior ao campo175px do celular oficial390. Nenhum botão do compositor foi reduzido, ocultado ou rearranjado. O piso320 provisório não foi usado sozinho como aceite.

## Estado, SSR e foco

Preferência do painel: `null` automático, `true` aberto, `false` fechado. Cruzar o limiar de três colunas restaura automático. Abrir em uma vista troca para painel; passar dessa vista para duas preserva abertura como sobreposição. Resize para uma vista volta à conversa, sem foco em nó oculto.

CSS determina o primeiro paint responsivo. O store de media queries tem snapshot neutro igual no servidor/hidratação e assinatura limpa ao desmontar. `aria-pressed` é omitido enquanto a largura ainda não foi obtida e depois expressa o estado efetivo, inclusive automático; não compara somente `state === true`. `aria-controls` liga o gatilho sempre visível à única instância do painel.

PainelContato mantém uma única montagem em coluna/sobreposição/vista própria. O conteúdo atual e as keys distintas de PainelAria/AcoesContato são preservados. Oculto: display none, aria-hidden e inert. Abertura automática desktop não captura foco. Abertura manual foca Fechar; sobreposição/vista própria usa useDialogo existente para pilha de diálogos, Tab/Shift+Tab, Escape e retorno ao gatilho. Coluna manual fecha com Escape dentro do painel e devolve foco. Mudança de modo não remonta campos e resgata foco se o painel fica oculto. Não altera helper global.

Contenção304 preservada: min-h-0, scroll interno da thread/painel, header relativo com limite40% e conteúdo do painel relativo para conter sr-only absoluto. Fonte, permissões e leituras do servidor mantidas.

## Harness e evidência

CLI ganhou painel-fechado, novo gatilho “Painel do contato” e espera da superfície única. Esperas continuam exigindo mensagem/nota reais da fixture, sem esperar conversa oculta ou painel fechado. Guardas negativos de altura, posição e animação preservados. Warnings React de chave/hidratação no app também invalidam captura.

A prova real de console detectou ReactNode do sino sem key na passagem server→client; a key foi corrigida na origem da página. Negativo preservado, seguido de repetição do mesmo probe com zero warnings. Não é atribuído ao preexistente E0.

Relatório e comandos/gates: `output/inbox-308-report.md`. Evidências: `output/inbox-308-visual/`. Medições geométricas, interação real e capturas app×protótipo são provas distintas; nenhuma substitui o parecer independente do TESTER. Conteúdo interno ainda é o atual, por contrato; a referência possui rail64 e recursos de etapas futuras. Sem mensagem enviada, cadastro ou alteração financeira.

## Modal local e limite preexistente de confirmação

Sem véu não significa fundo interativo: sobreposição/vista própria anunciam dialog/aria-modal e isolam os irmãos de cada ancestral até body com inert. Helper exclusivo do painel, sem alterar Drawer/useDialogo. Primeiro useDialogo captura o gatilho e foca Fechar; efeito seguinte isola. Cleanup de layout solta somente nós tocados antes do cleanup passivo devolver foco. Nós previamente inert são preservados. Coluna não isola. Resize e unmount liberam o isolamento.

Probe real com Chrome/CDP em1024/390 confirmou lista, thread e Sidebar inert e ignoradas na árvore AX; clique externo interceptado para evitar ação não chegou ao alvo. Resize para1400/959 libera o fundo. Snapshot textual do Playwright inclui elementos inert e não foi usado como prova AT; a confirmação usa Accessibility.getPartialAXTree/getFullAXTree do Chrome.

Escape em confirmação filha fecha somente a confirmação e conserva o painel (coluna/sobreposição/celular). Limitação preexistente confirmada pelo integrador nas bases103/130: OptOutContato desabilita o botão de origem antes da captura de activeElement pelo Modal; por isso a confirmação retorna foco ao BODY nos três tamanhos. Não corrigido nesta issue por ruling explícito; probe negativo preservado. O retorno do painel ao seu próprio gatilho, critério308, passou em32contextos.
