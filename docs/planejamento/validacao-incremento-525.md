# Incremento 525 — continuidade após retomada aplicada

15/09/2026. Integração de Q66 com o planejamento mensal de Q30/Q64/Q160. Agente Terra implementou a leitura da fonte; o orquestrador alterou o cálculo, integrou o carregador e validou o fluxo.

## Problema e alteração

A retomada já aprovada pode aplicar uma cobertura parcial: retorno em 2 de janeiro, cobrindo até 31 de janeiro, por exemplo. O planejador mensal exigia que a última cobertura começasse no primeiro dia do ciclo e recusava esse estado legítimo.

O cálculo agora possui um caminho interno específico para retomada efetivamente aplicada. Aceita o trecho final do ciclo somente quando o fim coincide com o limite da referência contratual; a próxima cobertura começa no dia seguinte e corresponde ao próximo período integral. Preserva preços e a referência de vencimento Q160. O caminho normal continua recusando coberturas parciais sem essa origem.

O carregador não recebe uma declaração do cliente de que houve aprovação. Confere a cobrança persistida, vínculo à matrícula, proposta aplicada, decisão independente, datas, hash da entrada, seleção dos itens, cobertura do snapshot e evento de aplicação correspondente. Fonte ausente, divergente ou ambígua não habilita o caminho especial. Apenas aprovar a retomada, sem aplicá-la, não basta.

## Validação

- Dezoito testes do cálculo aprovados, incluindo retorno parcial no mês civil, ciclo com âncora 31 e rejeição de fim incompatível: `docs/validacao-calculo-525-2026-09-15.json`.
- 26 integrações da pausa/retomada aprovadas: `docs/validacao-integracao-retomada-525-2026-09-15.json`. Foram ampliados os cenários com recebimento parcial e integral, verificando fonte antes/depois da aplicação, outro contrato, datas divergentes e cálculo do período seguinte.
- Após reforçar a conferência do hash, itens e evento de aplicação, os dois cenários afetados foram repetidos junto à regressão mensal com contrato/aditivo: três integrações aprovadas, 58 não selecionadas: `docs/validacao-integracao-fonte-525-2026-09-15.json`.
- ESLint focado e compilação aprovados: `docs/validacao-build-525-2026-09-15.log`.

## Limites

O planejamento não emite cobrança e não dispensa comprovação de oferta, ausência de compensação ou os demais requisitos contratuais. Q161 continua pendente. Coberturas deslocadas por recomposição Q70 e seleção de cobranças canceladas ainda precisam de tratamento próprio; a retomada não é usada para liberar essas situações por semelhança.

As tabelas antigas da retomada não possuem, na migração original, a mesma proteção de imutabilidade por trigger dos fluxos financeiros mais recentes. A leitura acrescenta conferência cruzada do estado e do evento, mas não equivale a uma migração que impeça toda adulteração direta no banco. Esse reforço permanece necessário antes de concluir a auditoria de integridade integral. Nenhuma migração ou operação externa foi executada neste incremento. A SPEC integral permanece em implementação.
