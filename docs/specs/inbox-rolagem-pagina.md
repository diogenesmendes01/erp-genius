# SPEC — Inbox #304: página sem rolagem dupla

## Contrato e escopo

Dependência: #299, origem `729a0fe7faeb7ea918fa0223c58912ff45ef4a37`. Rebase para a base E0 integrada `797994aaab6f53017b72a808cf0de92abf827ac5` antes dos gates finais. A página ocupa a área útil do layout; `InboxNovo` ocupa o espaço restante e pode encolher. Lista e thread mantêm rolagem própria. Título, sino, formulário, campos e ações permanecem disponíveis. Sem alteração de contrato de dados, envio, capacidade, schema ou SSE. A nova base inclui as seis issues E0 já publicadas e o pré-requisito Next; o diff #304 continua restrito à geometria e seus testes/evidências.

## Geometria medida antes de implementar

O main tem padding vertical de 32 px abaixo de md e 64 px em md+. A barra mede 57 px abaixo de sm, **53 px de sm até md** e não ocupa altura a partir de md. Portanto a página usa `100dvh - 2rem - 3.5625rem`, no sm `100dvh - 2rem - 3.3125rem`, e no md `100dvh - 4rem`. O Inbox deixa de definir altura pela viewport e mínimo de 420 px: recebe `flex-1 min-h-0`.

O formulário sempre aberto ocupa no máximo 30% da página, os filtros até 50% da lista e o cabeçalho de ações até 40% da conversa, com rolagem interna quando necessário. Essas reservas mantêm área positiva de mensagens nos tamanhos baixos medidos. Não ocultam controles e não mudam o fluxo. Cabeçalho da conversa e painel lateral têm contexto relativo: seus avisos `sr-only` absolutos precisam ficar contidos para não aumentar o documento fora da área de rolagem.

## Evidência observada no aplicativo

Chrome local via Playwright, Node 22.23.2, app real Next e banco descartável `dev-email`, servidor do integrador em localhost:3110. Matriz de 6 tamanhos × 2 temas × com/sem seleção = 24 cenários por fase; formulário sempre aberto no estado atual da página. Todos os 24 finais têm `documentElement.scrollHeight == innerHeight`, largura do documento igual à viewport e zero `pageerror`.

| Viewport | Documento antes | Documento depois | Inbox depois |
|---|---:|---:|---:|
| 1440×900 | 1045 | 900 | 627 |
| 1024×768 | 933 | 768 | 475 |
| 390×844 | 1221 | 844 | 452,5 |
| 700×768 | 961 | 768 | 447 |
| 390×500 | 925 | 500 | 211,7 |
| 1440×500 | 693 | 500 | 233,2 |

O harness percorre todos os controles visíveis do formulário/filtros/cabeçalho com `scrollIntoView` e confirma que são alcançáveis dentro de sua região. Todos passaram. Para provar a rolagem dos contêineres com fixture curta, insere e remove um bloco visual `aria-hidden` de 2000 px, confirma deslocamento e restaura a posição. É uma prova geométrica temporária de overflow, não uma carga de centenas de atendimentos nem teste de paginação. No celular selecionado de 500 px, a thread mantém 69 px úteis; em desktop de 500 px, 82 px. A rolagem de ações fica dentro do cabeçalho, o compositor continua no rodapé.

## TDD e validação

Testes SSR de page/InboxNovo: raiz flex limitada e filho flex que encolhe; Inbox sem altura por viewport/min-height de 420 px. Vermelho observado antes da implementação (2 falhas/23 aprovados), verde depois (25/25). A geometria CSS é validada pelo aplicativo real, não inferida somente das classes. Recorte: Inbox + responsivo + paleta + design-system + botoes, sem testes ignorados. Gates globais no relatório DEV.

## Limites

Medições cobrem os seis tamanhos da tabela, zoom normal e fonte padrão carregada, nos temas claro/escuro. Não afirmam suporte irrestrito a alturas arbitrariamente menores, zoom ampliado ou conteúdo de formulários futuros. Não foi feito envio nem abertura de atendimento; fixture local fictícia com transportes externos desativados. A seleção da conversa pode marcar leitura pela implementação #299 já existente, apenas no banco de teste. O indicador de Issues do Next dev e avisos de chave duplicada são preexistentes; nenhum erro de página ocorreu. O painel drawer menor e menus de mensagem pertencem a outras issues. TESTER deve revisar o SHA exato e homologar visual; merge/deploy dependem do integrador.
