# Investigação privada de navegação #313 — resumo sanitizado

Fonte histórica da aplicação: 9c977ebb1617392d7d1a17362ab16fde091ac5e5. Comparação anterior à #313: dd141ac28b34c9c3d90470c60960be18b7da6a45. Mesmo banco B, porta 3111, Node22, dependências locais e fixtures, sem seed/reset/instalação. A fonte atual receberá R6 em merge separado; os resultados abaixo não são atribuídos ao merge.

## Comparação comum

- Probe v1 `probe-minimo-navegacao.mjs`, SHA256 ABDDA00D3632567419E02E0CF8499BBBF9C34E19E3B59B2797233B43E2F7A9FD: baseline 6 execuções exit0; 9c 5 exit0 e 1 exit1 por GET de mensagens abandonado. Nenhuma navegação completa adicional.
- Probe v2 `probe-minimo-navegacao-v2.mjs`, SHA256 B93799EBD6A9D82853732A4A108A19DC3E3CFB1AA318BF79CE221FEE9A62CAF7: seis URLs de filtros via replace, três cliques reais em Beatriz e Link público ou router.push instrumentado. Baseline e 9c: duas execuções exit0 em cada fonte, sem segundo GET document/timeOrigin novo. Pastas mínimas mantêm prefixo minimo e timestamps distintos; v2 não sobrescreveu v1.
- Não reproduziu o fluxo longo negativo: isso não demonstra preexistência, ausência de defeito ou causa atribuível à #313.

## Evidência causal do fluxo longo em 9c

`trace-causal.mjs` deriva do probe longo, sem alterar aplicação/Next. Sem CDP, sessão24036 exit1 em causal-2026-10-23T02-35-45.014Z: pedido Mariana, depois GET document Beatriz e novo timeOrigin. Actions responderam 200 text/x-component, sem x-nextjs-action-not-found, x-action-redirect ou Location. Só [HMR] connected, sem rebuild/FastRefresh registrado nessa execução. Corpos RSC e cabeçalhos brutos permanecem PRIVADOS, excluídos de Git/ZIP.

Com breakpoint CDP passivo na entrada de completeHardNavigation: sessão42395 exit1 em02-36-34.124Z; execução intermediária02-37-35.262Z exit0; sessão12474 exit1 em02-37-51.142Z. Pausas CDP alteram timing e não são apresentadas como fluxo natural. A última pausa capturou:

- pilha completeHardNavigation ← serverPatchReducer ← clientReducer;
- state.canonicalUrl = /inbox?c=inbox-demo-mariana-307;
- destino = /inbox?c=inbox-demo-beatriz-307;
- action.type = server-patch; action.mpa = true; seed não nulo;
- action.previousTree === state.tree: false.

O código instalado de server-patch-reducer testa mpa/seed nulo antes de verificar previousTree. O patch de árvore obsoleta foi aplicado no ramo MPA apesar da intenção mais nova. Isso identifica o ramo causal do recarregamento; não demonstra a origem da incompatibilidade de árvore nem sua preexistência antes da #313. Nenhum arquivo Next, backend de leitura ou dependência foi alterado. A correção exige coordenação técnica própria, sem atribuição ao PR387 de exports.

## Limites dos controles adicionais

Probe comum v3, último /inbox via push e quatro RAF entre cliques: exit0 em9c; não reproduziu. Retenção controlada de RSC legítimo Beatriz, resposta200 liberada depois de intenção Mariana ou Link público null: ambos exit0 em9c. Esses probes instrumentam timing e não comprovam fluxo inteiramente natural nem comparação anterior. Primeira tentativa hold02-39-29.291Z não reteve resposta alguma (inconclusiva, embora o programa terminasse0), preservada; variante corrigida exige pelo menos uma resposta retida.

## GET abandonado

Negativo v1 9c em minimo-9c977ebb-nenhum-link-2026-10-23T02-32-57.131Z: GET http://localhost:3111/api/inbox/atendimentos/inbox-demo-beatriz-307/mensagens ERR_ABORTED, final /inbox, vista lista, sem novo documento. Observação passiva adicional em hold-rsc-v2-9c977ebb-replace-link-2026-10-23T02-41-56.945Z capturou o sinal do mesmo endpoint abortando depois de location=/inbox, stack HistoricoConversa.limpar → commitHookEffectListUnmount. useConversa devolve limpar no cleanup e limpar chama controller.abort. Isso comprova cancelamento esperado ao abandonar a conversa; a execução original continua negativa e nenhum classificador global foi relaxado.

## Infraestrutura

A tentativa posterior de complemento público terminou exit1 por ECONNREFUSED ::1:3111: o integrador havia encerrado o preview entre as mensagens. Browser fechado, manifesto negativo preservado; não é classificação de defeito produtivo.

Todos os browsers foram fechados antes da integração R6. Evidências brutas e imagens negativas ficam locais; este resumo não contém corpos RSC, autenticação ou logs brutos e pode acompanhar o ledger. Adjudicação final e repetição na base corrente permanecem pendentes.
