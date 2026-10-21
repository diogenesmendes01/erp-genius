# Incremento 604 — novo ciclo após recomposição e prévia financeira

16/09/2026. Objetivo integral continua em implementação.

## Decisões registradas

Q161=A: conferir agenda/vínculo do contrato e exigir confirmação pedagógica específica por período, com justificativa, quando essas fontes não comprovarem continuidade. Q162=A: após cobertura deslocada por compensação, iniciar a próxima no dia seguinte ao fim da anterior, estabelecendo o novo ciclo mensal. Ambas estão registradas na SPEC central e em `continuidade-q161-q162.md`.

## Implementação entregue

O carregador da prévia consulta a última recomposição Q70 efetivamente aplicada da matrícula. Confere o snapshot e a correspondência das coberturas alteradas com as cobranças atuais da mesma matrícula. Fonte ausente não produz referência; fonte divergente não recua silenciosamente para uma aplicação antiga. Proposta sem aplicação não habilita o novo cálculo. A referência vem do dia seguinte ao fim do último período deslocado.

O planejador usa essa referência como ciclo mensal, preservando a referência contratual original na memória de cálculo junto de aplicação, decisão e cobrança de origem. O exemplo 03/out–02/nov resulta em 03/nov–02/dez; ciclos seguintes conservam a referência, inclusive quando o dia 31 não existe no mês. Não pular intervalo entre a última cobertura e a referência. Vencimentos novos continuam seguindo Q160/Q99; o planejamento não altera vencimentos emitidos. A barreira contra sobreposição de dias compensados permanece.

A prévia exibe versão das condições, preços de origem e aplicados, referência do vencimento, calendário financeiro, situação de indisponibilidade e referência do novo ciclo quando aplicável. Não apresenta ausência de relato como oferta comprovada nem o marco calculado como cobrança emitida.

## Evidências

- **38/38 integrações**: três cenários de compensação de cobertura e 35 de aditivos, executados no banco local de testes. `docs/validacao-integrada-final-604-2026-09-16.json`.
- O cenário real de recomposição verifica ausência de referência antes da aplicação, referência após aplicação, isolamento de outra matrícula, vencimento preservado e cálculo subsequente com a fonte persistida. Isso não equivale a emissão real.
- **34/34 testes unitários/apresentação**: cálculo mensal, referência Q70, vencimento financeiro e um teste SSR da prévia. `docs/validacao-unitaria-final-604-2026-09-16.json`.
- Tipos, lint e build aprovados: `docs/validacao-tipos-final-604-2026-09-16.log`, `docs/validacao-lint-604-2026-09-16.log`, `docs/validacao-build-604-2026-09-16.log`. A primeira checagem de tipos identificou sintaxe incorreta no teste novo, corrigida antes da validação final.

## Limites e trabalho restante

`podeEmitir` permanece falso. A comprovação positiva Q161, executor recorrente, idempotência da emissão e persistência da memória em novas cobranças ainda não estão entregues. A integração de regressão de aditivos cobre o fluxo normal da prévia; o novo caminho Q162 tem teste de fonte aplicada mais cálculo e ligação no carregador, mas ainda requer cenário completo de prévia com condições contratuais, recomposição e preço no mesmo teste.

A combinação de recomposição com origem aplicada de retomada Q66 ou regularização integral Q159 na última cobrança volta à conferência, em vez de escolher precedência silenciosamente; a continuidade desses casos combinados permanece incompleta. Recomposição sem período financeiro deslocado não fornece a origem implementada neste incremento e exige tratamento próprio. Não declarar Q162 integralmente concluída enquanto esses caminhos e a emissão não estiverem cobertos.

Não houve migração, envio externo, operação em produção ou homologação interativa de navegador. SSR e build não substituem a validação visual.
