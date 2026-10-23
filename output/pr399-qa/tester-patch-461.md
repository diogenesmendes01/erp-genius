# QA independente — PR #399, remoção de props órfãs

Fonte exata: `461dbf9e8840dfa59ad86b947e2d6c14bbf3aacd`, pai `62e0f74db7729cf4c4e2bf63d055d57eb97d7022`. Parecer favorável ao delta, sem achado alto/médio. Checkout detached e rastreados limpos.

## Escopo e inspeção

- Somente `ConversaAberta.tsx` e seu teste mudam em `src` (`f6fa20`, `1f5faa`). Foram retirados o import type `ItemTriagem/RevisaoEnvio`, o comentário e as props opcionais `triagem/revisoes`, sem alteração de JSX, fluxo ou permissão. O único consumidor produtivo é `InboxNovo`, que não passava essas props; página passa triagem/revisões ao `InboxNovo`, e este usa `PainelTriagem` na casca.
- Saiu um teste SSR que injetava `triagem` diretamente em `ConversaAberta` e comprovava apenas sua ausência — a prop era ignorada. Permanecem três casos reais em `InboxNovo.interacao.test.ts`: composição de blocos e uma instância de `PainelTriagem` sem prop na thread; seleção A→B não reaproveita tags; triagem sem seleção continua na ponte. `PainelTriagem.test.ts` permanece no recorte.
- A carga contextual sem acesso permanece no `InboxNovo`: `conhecido` só é aproveitado quando seu ID coincide com o selecionado; 404 subsequente conserva o painel do mesmo contexto com `acoes:null` e `podeEnviar:false`. Isso não implica que Aria/opt-out desapareçam ou que todas as ações de outras alçadas sejam bloqueadas. O servidor continua validando suas ações. Nenhum código desse contrato foi alterado pelo patch.
- SPEC e relatório distinguem a composição do painel, os limites das provas históricas e o inventário de evidências. Nenhum output histórico foi removido ou regravado neste commit. `git diff --check` no delta de código/SPEC/relatório retornou 0 (`1f5faa`).

## Execução própria

Node 22.23.2, Vitest local, TZ=UTC, `--maxWorkers=2`, sem filtro de nome ou skips novos: `ConversaAberta.test.ts`, `InboxNovo.interacao.test.ts`, `InboxNovo.foco.test.ts`, `PainelContato.test.ts`, `PainelContato.interacao.test.ts`, `PainelTriagem.test.ts`: **6 arquivos / 130 testes aprovados, exit 0**, execução `e74acc`.

## Limites

Não executei banco, browser, Prisma, instalação, typecheck, lint ou suíte global. Os 12 arquivos/165 testes e outros gates do DEV são evidências dele, não minhas. C1/CI/composição com main e QA #280, e C2/integração final permanecem com o integrador; este parecer não homologa a futura fonte composta.
