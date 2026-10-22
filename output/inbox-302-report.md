# #302 — Prazo estourado vivo

Estado final em 22/10/2026: **implementação e validação concluídas; PR em publicação**. TESTER aprovou o código `1740a337` e o commit documental `133b935e`, com 19/19 testes dirigidos e aceite visual no aplicativo. Branch `codex/inbox-e0-302`, baseada em `1ce8e582` (PR #381). O integrador consolida somente documentação, capturas e manifestos; nenhuma fonte ou teste mudou depois dos gates. As pendências nas seções cronológicas abaixo foram resolvidas conforme o aceite final. Sem merge/deploy.

## Aceite final e runtime

Parecer independente em `output/inbox-302-visual/qa/inbox-302-review.md`. Capturas antes/depois em `output/inbox-302-visual/{antes,depois}/`: 48 PNGs e dois manifestos, com seis combinações de tamanho/tema por fase. As mesmas páginas permaneceram abertas, sem reload: na base o selo continuou ausente após vencer (0→0); depois apareceu automaticamente (0→1). Prazo do banco intacto e `pageerror=[]`. Sessão ANTES do integrador `24336` e DEPOIS do TESTER `31652`, ambas saída 0, com Node 22.23.2. O integrador também inspecionou o recorte móvel escuro vencido e repetiu os 19 testes de prazo no Node 22, saída 0.

Os gates globais registrados abaixo foram executados com Node 24.16.0. A captura e o recorte adicional no Node 22 identificam explicitamente a validação posterior; não atribuímos à suíte global um runtime diferente. Nenhum transporte externo foi ativado. A mudança cobre o selo dos itens carregados; o filtro de servidor permanece pontual. O overlay preexistente de desenvolvimento não encobre o selo nos recortes. CI só dispara para base main; redirecionar após integrar o pré-requisito #381.

## SPEC e limites

O selo dos atendimentos já carregados aparece automaticamente **1 ms depois** de `prazoRespostaEm`, preservando a comparação estrita existente (`prazo < agora`). Grupos, encerrados, itens sem prazo e datas inválidas não provocam vencimento nem timer futuro. Não há polling, refresh ou consulta adicional ao servidor. Esta issue não faz um atendimento entrar automaticamente no filtro de servidor de prazos quando o relógio passa.

Interfaces públicas de `src/app/(app)/inbox/prazo-vivo.ts`, preservadas para #309/#312:

- `prazoEstourado(i: Pick<ItemListaInbox, "grupo" | "status" | "prazoRespostaEm">, agora: number): boolean`: mesma regra anterior da lista.
- `proximoEstouroEm(itens: ItemListaInbox[], agora: number): number | null`: menor prazo estritamente futuro entre atendimentos individuais ativos, ignorando datas inválidas.
- `TETO_TIMER_MS = 2_147_483_647`.
- `esperaAteProximo(proximo: number | null, agora: number): number | null`: ausência de próximo devolve null; demais casos usam `min(max(proximo - agora + 1, 0), TETO_TIMER_MS)`.
- `useAgoraDosPrazos(itens: ItemListaInbox[]): number`: um relógio para a lista atual, com snapshot estável entre vencimentos. A assinatura mantém no máximo um timeout, limitado ao teto nativo; ao disparar, atualiza o relógio real e agenda o próximo vencimento. Limpeza ao trocar lista/desmontar.

`ListaAtendimentos` consome o hook e `prazoEstourado`; a marcação e as classes permanecem iguais. Nenhuma alteração de schema, servidor, permissão, pacote, lockfile ou código da #299.

## Decisões técnicas e execução

- Ruling: substituir o pseudocódigo de estado/efeito da task por uma assinatura local `useSyncExternalStore`, mantida com `useMemo` por identidade de `itens` — o pseudocódigo usa um `agora` envelhecido na chegada SSE e atualizá-lo sincronamente em efeito acrescentaria aviso à baseline React. A assinatura inicializa a lista nova com `Date.now()` e agenda usando o relógio real, sem setState síncrono em efeito ou medição impura direta no corpo do hook. Custo: um helper privado de relógio além das interfaces exigidas.
- Ruling: a função pública de próximo prazo continua estritamente `> agora`; o agendamento interno a consulta com `referencia - 1` e calcula a espera contra `referencia` — prazo exatamente igual ao instante atual ainda precisa de um timer de 1 ms para a regra estrita `<`. Sem isso, um prazo recebido exatamente agora ficaria sem futuro agendado.
- Testes de interação usam **React DOM e hooks reais** sobre `src/test/dom-minimo.ts`, com fake timers somente para Date/setTimeout/clearTimeout. Não simulam estado/efeitos nem copiam o algoritmo do hook. Listas ficam abaixo do limiar de virtualização; layout e apresentação no navegador dependem da captura visual posterior.

## TDD observado e testes dirigidos

1. RED de comportamento antes de criar o módulo ou mudar a lista: `node_modules/.bin/vitest.cmd run 'src/app/(app)/inbox/prazo-vivo.interacao.test.ts'`: **exit 1**, **8 testes com falha por assertion**, resultado terminal `16fc8a`. Incluiu montagem às12h seguida de lista nova às12h30 com prazo12h35, que deve vencer em5min reais; e lista nova às12h30 com prazo12h25, que deve exibir o selo imediatamente. A implementação anterior não criava timer e mantinha relógio de montagem.
2. RED das interfaces: `node_modules/.bin/vitest.cmd run 'src/app/(app)/inbox/prazo-vivo.test.ts'`: **exit 1**, módulo `./prazo-vivo` inexistente, sem testes executados, resultado `76d8b7`.
3. GREEN inicial: `node_modules/.bin/vitest.cmd run 'src/app/(app)/inbox/prazo-vivo.test.ts' 'src/app/(app)/inbox/prazo-vivo.interacao.test.ts' 'src/app/(app)/inbox/ListaAtendimentos.test.ts' 'src/app/(app)/inbox/sem-polling.test.ts'`: **exit 0**, **4 arquivos/32 testes**, sem filtro de nome ou ignorados, `1c956b`.
4. Recorte obrigatório completo do Inbox: `node_modules/.bin/vitest.cmd run 'src/app/(app)/inbox'`: **exit 0**, **17 arquivos/168 testes**, sem filtro de nome ou ignorados, `b1d3d9`. Inclui `sem-polling.test.ts`. Não é suíte global ou integração.
5. `git diff --check`: **exit 0**, resultado `a3fd7f`.
6. Lint dirigido: `node_modules/.bin/eslint.cmd` sobre `prazo-vivo.ts`, `prazo-vivo.test.ts`, `prazo-vivo.interacao.test.ts` e `ListaAtendimentos.tsx`: **exit 0**, sem erros/avisos, `b224ee`.

Cobertura pura: menor futuro, passados, grupos, encerrados, vazio/sem prazo/inválidos, empate, fronteira exata, espera nula/negativa e teto. Interação real: selo no prazo+1 ms, dois casos SSE com relógio envelhecido, prazo recebido no instante exato, múltiplos/empates com um timer, troca e cancelamento do timer antigo, desmontagem, remoção do próximo prazo e agendamento acima do teto nativo sem vencer cedo. Todos os comandos acima terminaram diretamente com exit code; nenhum `session_id` pendente ou processo desacoplado. Aviso preexistente de `vite-tsconfig-paths` não tratado nesta issue.

## Pendências e contrato visual

A janela global foi liberada pelo integrador após a conclusão do DEV B; resultados próprios desta issue estão abaixo. Não reutilizados os gates da #298. TESTER deve revisar o SHA exato entregue em seu worktree/banco.

Captura visual posterior coordenada: selo aparecendo sem reload em atendimento fictício, 1440×900, 1024×768 e 390×844, temas claro/escuro, com evidência antes/depois ou vídeo. Nenhum transporte externo deve ser ativado. O teste de interação cobre o comportamento temporal, mas não substitui a homologação visual. Sem push/PR/merge/deploy neste papel; integrador publica um PR por issue. Não marcar #302 concluída enquanto faltarem esses gates.

## Gates globais finais no SHA de código `1740a33712e0b7f1cbef26008a6e4ca1e23ef8cc`

O rebase sobre `1ce8e582` antecedeu os três gates. Somente o quadro teve conflito documental, resolvido preservando a entrada final da #298 e a nova #302; nenhum código precisou de resolução.

- `NODE_OPTIONS=--max-old-space-size=8192 node_modules/.bin/tsc.cmd --noEmit`: **exit 0**, sessão `39736`, conclusão terminal `e2d961`.
- `node_modules/.bin/vitest.cmd run --reporter=json --outputFile=output/inbox-302-unitarias.json`: **exit 0**, sessão `86563`, conclusão `bfba79`; JSON conferido em `e90e6a`: **841 arquivos, 6.485 testes aprovados, zero falhas, pendentes ou todo**, sem filtro de nome. Essa é a suíte unitária completa configurada; `*.int.test.ts` continua excluído pela configuração normal. Relatório JSON fica apenas local, fora do commit.
- `node_modules/.bin/eslint.cmd . --max-warnings 40`: **exit 0**, sessão `23565`, conclusão `724e49`, **zero erros e 40 avisos preexistentes**, sem exclusões adicionais; o hook novo não acrescentou avisos.
- `git diff 1ce8e5820094e988a56da4868aedb037fdbd22df HEAD --check`: **exit 0**, `e90e6a`.

Cada processo foi acompanhado na própria sessão até o código final; nenhum ficou ativo. Esta consolidação posterior modifica apenas o relatório/quadro, sem repetir gates ou mudar a fonte validada. Re-review TESTER e captura visual do selo ao vencer sem reload continuam pendentes; implementação não está marcada como entrega concluída.
