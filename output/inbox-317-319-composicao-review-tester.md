# QA independente da composição #317+#319 — 93a5b66f5557aad977248257379b094cbfeca85c

Parecer estático favorável ao checkpoint composto, condicionado ao C2/#402, CLI/harness317, browser e global. Revisei no worktree tester o merge de pais `c2b7d9205a74d23a2bdb7de6fcb256c9e85affc8` e `3dc215ef0be1e9e3eaf3782fd8692fb6cb3b89c3`. Não houve banco/browser, edição de produção ou alteração do CLI da DEV A.

## Composição de fonte

- O conflito funcional de `ConversaAberta` foi resolvido preservando `CoordenadorAcoesConversa key={item.id}` e `useChavesPorAlvo` acima dele. `CabecalhoConversa` e `RodapeConversa` recebem a mesma instância de ações, incluindo `abrirAgendar` real; não há segundo hook `useAcoesAtendimento`. O filho `renderizarConversa` continua no mesmo lugar React durante carga, erro, busca e troca de aba; `VirtualList stableMount`, `scrollRef`, `pinKeys`, nota como item da thread e os quatro argumentos de `itensDaThread` não foram removidos.
- Dentro desse mesmo render-prop entraram `aria-busy`, skeleton somente sem mensagens **e notas**, erro público sem texto técnico, retry e anteriores via `Botao` com guarda de ocupação e entrega síncrona de foco. O rodapé, Compositor e seus rascunhos permanecem fora dos ramos condicionais de loading/erro. O fallback para `item:null` continua sem controlador e sem envio.
- Objetos Git preservados: `Compositor.tsx` 5776af78 e `RodapeConversa.tsx` cdf43252 iguais à #317 a86; `Esqueleto.tsx` 0a7b8a02 e `InboxNovo.tsx` ee3e6047 iguais à #319 472e. `useBuscaConversa.ts` permanece 399d6bf1 igual à base294, logo este SHA **ainda não contém C2/#402**. A fonte de busca/VirtualList e a política de leitura não foram alteradas neste merge.
- Os três registros de `Botao` da #319 foram adicionados ao mapa já atualizado pela #317; a isenção antiga de `Mensagens anteriores` foi removida. O teste de busca mesclado passou a localizar o `CabecalhoConversa` realmente montado, exigindo sua existência, sem trocar os asserts de identidade/pin/termo/foco. `git diff --check` contra o primeiro pai saiu 0.

## Execução própria

Node22 local/Vitest local, `--maxWorkers=2`, sem filtro por nome/skip: 8 arquivos/276 testes exit0 (busca/rodapé/Conversa/Inbox interação/Compositor/histórico/guarda de botões) e 4 arquivos/50 testes exit0 (Inbox SSR, PainelSetor, Esqueleto, Rodape). Total dirigido 12 arquivos/326 testes. Uma primeira invocação apontou por engano ao Vitest dentro da pasta do Node e não iniciou teste; corrigi o caminho imediatamente e só os dois exits 0 acima contam. Não reatribuo GREEN12/312, TSC/lint do integrador a esta revisão.

## Limites

O teste do render-prop e do DOM mínimo não demonstra preservação física de nó, âncora de scroll ou foco no Chrome. O preview composto deve provar mesma montagem ao alternar Responder/Nota e ao entrar/sair de loading/erro, `pinKeys` da busca316, nota carregada durante `?antes=`, foco do retry e agenda única. Os estados visuais e a autorização da nota ainda precisam de QA próprio com fixtures tester. C2/#402 e o CLI/formal da #317 seguem fora deste SHA; portanto não é aceite final nem homologação da composição publicada.
