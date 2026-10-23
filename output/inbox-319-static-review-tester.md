# QA independente #319 — fonte 472e17fd3c44d2163a853a2f706b7fba1c6206a8

Parecer estático favorável, condicionado à composição com #317, prova visual independente e regressão global coordenada. Base comparada: 29479848432d2b4fd37972f104b6b7e5cae62368. Não executei browser, banco, integração nem suíte global nesta fonte.

## Contrato verificado

- O delta produtivo limita-se a `Esqueleto.tsx`, `ConversaAberta.tsx`, `InboxNovo.tsx` e `PainelSetor.tsx`. `useConversa.ts` e `useEventosInbox.ts` têm OIDs idênticos à base (respectivamente cb4527c0 e 42d3ea4a); não há alteração de transporte, leitura, R6, fila ou escopo servidor. `git diff --check` terminou com saída 0.
- `ConversaAberta` monta o esqueleto inicial só se estiver carregando e não houver mensagens **nem notas**. Em recarga, paginação e erro, a `VirtualList stableMount` continua no mesmo ramo, com `itensDaThread` recebendo os quatro argumentos, `scrollRef` e `pinKeys` da busca mantidos. O alerta público omite o erro técnico. Retry e paginação usam o método real do hook, bloqueiam acionamento quando ocupado e entregam foco sincronicamente ao campo de busca aberto ou à região `Conversa` antes da operação, sem callback de foco tardio.
- Painel ainda pendente mostra esqueleto somente no corpo. A distinção entre painel válido sem oportunidade e falha foi verificada: a API retorna objeto com `oportunidade:null` para ausência legítima; `buscarPainel` retorna `null` para falha e `sem-acesso` no 404. O primeiro renderiza aviso neutro, a falha inicial renderiza alerta/retry, e resposta antiga de outro atendimento é descartada pelo efeito com `ativo`. As regras anteriores de 5xx/404 depois de painel conhecido e `podeEnviar` ficaram fora do delta produtivo.
- Esqueleto da página usa os limiares reais 960/1100/1400, lista 300/372, painel 348, cabeçalho 68 e sem mínimo 420. Um marcador de título; esqueletos parciais sem novo título/avatar. Desenhos decorativos `aria-hidden`, anúncio único de carregamento por instância. A geometria real e a ausência de overflow ainda exigem browser.
- Novo estado sem seleção conserva triagem/revisões e deixa a área central livre. Novos controles `Botao` estão registrados exatamente em `botoes-mapa.ts`; a antiga isenção do botão artesanal foi retirada, mantendo a trava AST.

## Execução própria

Node 22 local, Vitest local, sem filtros de nome e `--maxWorkers=2`: 6 arquivos/170 testes, exit 0 (`ConversaAberta`, busca, `InboxNovo`, interação, `PainelSetor`, `Esqueleto`); 5 arquivos/136 testes, exit 0 (`InboxNovo.foco`, visibilidade de esqueleto, trava de botões, histórico e `VirtualList`). Total dirigido: 11 arquivos/306 testes. O aviso de `vite-tsconfig-paths` não afetou os resultados. Não atribuo a mim os 61 arquivos/861 testes, TSC e lint do DEV.

## Limites para aceite final

A fonte #319 ainda não contém a #317; a conciliação deve preservar os ramos de estados internos da thread, a montagem única do compositor e os hooks de leitura. Falta QA em navegador dos cinco estados `sem seleção`, `carregando`, `erro de painel`, `erro de thread` e `lista vazia`, nos tamanhos e temas previstos, com foco/retry, A→B tardio, notas e janela carregada. O teste unitário de ausência válida cobre objeto com campos nulos, não a geometria visual. Sem esses passos, este parecer não homologa UI final nem PR integrada.
