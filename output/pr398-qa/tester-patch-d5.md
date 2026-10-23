# QA independente do patch PR #398 — d5f78f9393ada93bc3e9a7d137aea207f5f60378

Parecer favorável aos ajustes C3/C4 neste commit exato. Não encontrei achado alto ou médio no delta local. C1/C2, composição com main/QA280, retarget e CI final continuam fora deste aceite.

## Fonte e revisão

- Checkout TESTER destacado em `d5f78f9393ada93bc3e9a7d137aea207f5f60378`, pai `ffddfdae6969e93f865be73357c95816d6b090aa`, rastreados limpos e sem colisões de artefatos privados.
- Delta funcional restrito a `itens-thread.ts` e `BalaoMensagem.tsx`; dois testes correspondentes, SPEC, quadro e relatório. Sem alterações de VirtualList, `agora-thread`, backend, SSR, SSE, banco, scripts ou dependências. `git diff --check` exit 0, chunk `f8dc55`.
- C3 mantém `diaAnterior` quando um item tem `criadoEm` inválido. Mensagem ou nota malformada não criam separador e a próxima mensagem do mesmo dia não duplica a key; transição civil real ainda cria dia. Itens, IDs e ordem recebida seguem intactos. O horário do balão usa `formatarInstanteExibicao`, que devolve texto bruto para data inválida sem lançar.
- C4 usa `autorNome?.trim() || "Autor não informado"` só na exibição da nota; null, vazio e whitespace recebem fallback. Nome preenchido, escaping React, origem e ausência de menu/status/mídia de nota permanecem cobertos.
- C5 é limite assumido na SPEC: uma thread totalmente ociosa pode conservar Hoje/Ontem através da meia-noite até nova revisão/seleção/conteúdo. O patch não adiciona timer ou polling. O mapa documental C6 relaciona nomes históricos da Task 9 a testes reais; não o trato como nova prova E2E.

## Execuções próprias

- Node 22 local, `TZ=UTC`, Vitest `--maxWorkers=2`, seis arquivos completos: `itens-thread.test.ts`, `BalaoMensagem.test.ts`, `SeparadorDia.test.ts`, `agora-thread.test.ts`, `VirtualList.test.ts`, `ConversaAberta.test.ts`: **6 arquivos/81 testes, exit 0**, chunk `709f5f`.
- Mesmo recorte em `TZ=America/Sao_Paulo`: **6 arquivos/81 testes, exit 0**, chunk `6afaa1`. Sem `-t` ou skips novos.
- Inspeção do diff e da SPEC, limpeza dos rastreados e `git diff --check`: chunk `7f1caa` / `f8dc55`, exit 0.

## Limites

Não executei DB, Prisma, navegador, suite global, TSC, lint, CI ou build. As execuções do DEV em nove arquivos/88 testes por fuso e os gates locais/CI externos não são minhas. Datas inválidas foram exercitadas na decoração/SSR unitário; nenhuma nova homologação ERP visual foi inferida. Este parecer cobre apenas C3/C4 e a documentação associada no SHA exato, sem resolver C1/C2 da revisão externa.
