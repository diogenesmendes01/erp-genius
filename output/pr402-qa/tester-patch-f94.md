# QA independente — PR #402 C3/C4

Fonte exata: `f94d3b762f503f33f51bcbf6a5a1e4d83e9eaefc` (pai `a8dba58c443ff24be4745e51aab47abed9c4cf2a`). Revisão no worktree TESTER; rastreados limpos. Parecer favorável para o delta, sem achado alto ou médio.

## Inspeção

- Delta de seis arquivos: única alteração produtiva acrescenta `e.shiftKey` à rejeição prévia do atalho regional. Ctrl/Meta+F simples ainda chamam `preventDefault` e abrem a busca; Shift/Alt não são capturados. O teste novo cobre as duas teclas modificadoras, inclusive combinadas, e desliga o listener. O guard anterior para foco/região visíveis, modal, composição e evento tratado não foi alterado.
- `useBuscaConversa.ts` e seu teste têm objeto Git idêntico ao pai (`9e9ad0a37219022d61db0e668787d399f22e0982` para o hook). `ConversaAberta.tsx`, teste de conversa, VirtualList, scripts, Prisma, package/lock também não mudaram; C2 de scroll manual/RAF/pin permanece fora deste delta.
- A SPEC agora descreve os valores já presentes em `BuscaConversa.tsx`: `min-h-11 flex-wrap`, `temMaisDepois`, `carregandoAntigas` e `campoRef`. O teste C4 adicional verifica ref, valor controlado e callback real da edição. Não houve alteração visual nem captura nova.
- `git diff --check` pai..HEAD retornou 0 (execução `03dba5`). O inventário C5 histórico não foi removido ou regravado neste commit. C6/conflitos entre branches não são resolvidos pelo patch.

## Execução própria

Node 22.23.2, Vitest local, `--maxWorkers=2`, sem filtros de nome ou skips:

| Fuso | Arquivos | Testes | Terminal |
| --- | ---: | ---: | --- |
| UTC | 4 centrais + 3 complementares | 31 + 9 aprovados | `0e5877` exit 0; `736cb9` exit 0 |
| America/Sao_Paulo | os mesmos | 31 + 9 aprovados | `de19a7` exit 0; `8c89a2` exit 0 |

Arquivos: `busca-conversa-dom.test.ts`, `BuscaConversa.test.ts`, `useBuscaConversa.test.ts`, `ConversaAberta.busca.test.ts`, `busca-conversa.test.ts`, `busca-conversa-virtual.test.ts` e `src/test/visual-inbox-busca.test.ts`. Estes testes verificam o contrato local; não são prova de browser ERP.

## Limites

Não executei banco, browser, Prisma, instalação, typecheck, lint ou suíte global. Os gates do DEV no relatório próprio não são minhas execuções. C1/main/CI, C6 e eventual composição QA #280 continuam sob integrador; este parecer não homologa o merge da PR #402.
