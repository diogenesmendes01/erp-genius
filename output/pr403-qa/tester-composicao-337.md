# QA independente de composição — PR #403

Fonte exata: `337832c083d508caab6bfb5eae2c3e2a04703805`, merge de `ea1fcf2552c9e4a93bfc10a3c85ddbb3d261d0ba` (#403, incluindo patch documental a5b8) e `7b1d2ca19e033deb019c9ef69287bd56ae8511d9` (base #402 composta). Parecer estático favorável, sem achado alto ou médio novo.

- `git rev-parse HEAD` confirmou o SHA; rastreados limpos. Compositor, `rascunhos-conversa`, Rodapé, Ações, Menu e o teste ReactDOM de rascunho têm objetos idênticos ao pai #403 (`git diff --quiet`, exit 0). Tokens de intenção, dono/chave, descarte de mídia temporária, autorização de nota e demais regras desse produto não foram reimplementados na resolução.
- `busca-conversa-dom` com a recusa de Shift, `useBuscaConversa`, Balão/decoração de thread, alias de preferências, projeção `estado-visual`, schema/migrações e package/lock são byteiguais ao pai #402 (exit 0). Planos #297, E2E e `.github` também iguais a esse pai (exit 0); `git diff --check -- src` terminou 0.
- Frente ao pai #403, `ConversaAberta.tsx` remove só import type `ItemTriagem`/`RevisaoEnvio` e as duas props órfãs; não altera JSX, hooks ou fluxo do compositor. O único teste SSR que injetava `triagem` na prop ignorada foi removido. Frente ao pai #402, a Conversa incorpora o coordenador/rodapé #403 e conserva a busca no cabeçalho, pin do achado e `itensDaThread` com quatro argumentos. A triagem real permanece em `InboxNovo` nas duas posições aplicáveis.
- O conflito de quadro preserva as duas frentes; não há introdução de estados futuros #319 nem DDL E2 neste recorte.

Não executei suíte, banco, browser, TSC, lint ou CI nesta extensão. Os gates do publicador para este head estavam em execução ao iniciar a QA e não foram atribuídos a mim. Em particular, os recortes históricos #399 9/187 e #401 10/201 não são gates deste SHA #403. A homologação depende dos resultados terminais próprios do publicador e do CI/composição final.
