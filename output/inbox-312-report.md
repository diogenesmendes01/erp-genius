# #312 — ledger DEV B

Branch codex/inbox-e1-312, basef56d6c5e3e1d5ce51e022b7b52277baee11c2486. Checkout1af78d exit0, branch311 ficou livre. Worktree exclusivoB, Node22.23.2 local. Decisõesdocs da base lidas; novas decisões de produto futuras não ampliam escopo312. Liberação parcial explícita: implementar consumidor/lista/usuarioId/relógio visual/guards/testes/docs, aguardar base308/harness/preview para capturas.

## Decisões

- Consumer puro usa estadoVisualItem/Avatar/BadgeEstado #309, sem reimplementar derivação. Lista mantém motor VirtualList, threshold100/estimativa104, paginação e EstadoVazio. InboxNovo somente usuarioId.
- Ruling do integrador: estender relógio único às fronteiras visuais de minuto de badge vencido; preservar APIs302 e regra estrita, sem polling/rede. Não acordar quando não muda texto/cor. Primeiro minuto mostra1min desde+1ms e só muda em2min.
- Grupos somente teste de render: trigger20261016110000 impede Atendimento de grupo. Ventura demo é individualB2B. Não tocar schema/trigger.
- CLI principal/núcleo/esperas/READMEharness continuam com DEV A308. Nenhum desses arquivos alterado nesta etapa; nenhum DBsuite/servidor acionado.
- Prova de virtualização real precisa >100itens e alturasvariáveis/foco/scroll. SSR atual não representa esse aceite.

## TDD e gates observados

- REDc5b71f exit1: ItemConversa ausente +8falhas de helper proximaMudancaVisualEm inexistente.
- cb6ca0 exit1: ItemConversa8/8 e regras30211/11 passaram; um caso puro tinha expectativa errada (28min59.5s muda em500ms, não59.6s). Corrigida a expectativa e acrescentado mínimo concorrente200ms; nenhuma mudança de lógica para acomodá-la.
- REDec81e9 exit1: consumidorLista/Inbox4falhas esperadas,39passaram em4arquivos; item/helper já verdes. Número/meta antigos e usuarioId ainda ausente.
- Interação inicial1f0cc2 exit1 por limitação do DOMmínimo sem createElementNS; não é RED funcional do relógio. Ícones decorativos substituídos só nesse teste; React/efeitos/store/ItemConversa/Lista continuam reais. Markup SVG real testado no unitário separado.
- REDrelogio7d2198 exit1:10falhas/1passou, mostrando ausência de timers vencidos/atualização29→30/59→60/StrictMode. Tentativa de substituição sem normalizarCRLF não alterou o timer (b97e5c exit1 com mesmas10falhas); corrigido o trecho com verificação explícita antes de escrever.
- GREEN4e2750 exit0:6arquivos65testes (ItemConversa,Lista,Inbox,prazo-visual,prazo-vivo e interaçãoreal), sem ignorados.
- REDguards83530/ad0f13 exit1:2falhas/420passaram em34arquivos, ambas exigiam registrar a nova linha de seleção no mapa exato de botões. Nenhuma guarda/AST foi relaxada; duas entradas pontuais autorizadas por arquivo/nome e quantidade.
- GREEN97215/4a7788 exit0:34arquivos422testes, sem ignorados no recorte. Inclui todo Inbox,VirtualList/virtual-window,Avatar,sharedSSE/Selo311 e guardsbotões/vazios/paleta/fundo/identificacao/fuso.
- TSC95079/2f7629 exit0 com heap8192 após fonte produtiva atual; só mapa de teste/doc alterados depois.
- Lint dirigido inicial9arquivos beffe8 exit0; final10arquivos21a225 exit0/0avisos. Não rodou fullunit/lintglobal/DBsuite nesta etapa.

Comando do recorte amplo:
```text
Node22 node_modules/vitest/vitest.mjs run "src/app/(app)/inbox" src/components/conversa/VirtualList.test.ts src/components/conversa/virtual-window.test.ts src/components/Avatar.test.ts src/lib/eventos-inbox.test.ts src/components/SeloNaoLidasInbox.test.ts src/components/SeloNaoLidasInbox.interacao.test.ts src/app/botoes.test.ts src/app/estados-vazios.test.ts src/app/paleta.test.ts src/app/fundo-sobre-pagina.test.ts src/app/identificacao-registro.test.ts src/app/fuso-pessoal-telas.test.ts --maxWorkers=2
```

## Pendências obrigatórias antes da entrega

Integração da casca/harness308 pelo coordenador; captura app×protótipo conversa/celular-lista/lista-vazia em3tamanhos/2temas; inspeção real inclusive legibilidade Mono600 sintetizada; >100itens com alturasmedidas/Tab/Shift+Tab/scroll/seleção/resize; preservação de negativos. Depois gates dirigidos finais, QAindependente e global integrado. Nenhuma homologação presumida. Não freeze/publicar como concluída antes dessas provas.
