# Incremento 448 — simulação de frequência de Q23

Data: 14/09/2026. Meta integral ativa.

Foi extraída uma rotina comum de apuração, mantendo a API oficial sem alterações. `simularFrequenciaCorrecaoAulaTx` usa essa rotina com uma substituição em memória da classificação de um registro. Exige aula ministrada, registro da matrícula e inclusão na trajetória histórica conferida. Não grava a chamada; identifica explicitamente o resultado como simulação.

A revisão institucional consulta a regra do vínculo mais recente de cada matrícula no nível e calcula antes/depois. Ausência de regra gera pendência explícita, sem mínimo presumido. Os resultados e a regra entram no hash da revisão; o instante da consulta é excluído. As notas e a aprovação da progressão continuam separadas.

## Evidências

- Dez integrações aprovadas: `docs/validacao-simulacao-aula-448-2026-09-14.json`.
- Cenário de falta para presença altera atendimento ao mínimo, preserva a apuração oficial e recusa registro/contrato diferente. O mínimo numérico desse cenário pertence somente à fixture.
- Regressões da trajetória de frequência, vínculos sobrepostos e hash temporal aprovadas.
- Build, TypeScript, lint e diff check aprovados.

## Limites

A simulação não representa aprovação da correção ou progressão. Ainda são necessárias a cobertura integrada de reposições válidas na simulação, a conferência completa de fechamento e efeitos financeiros/materiais, projeção efetiva após decisão, casos persistidos e interface. A integração de revisão com regra publicada exige teste específico além da apuração direta já testada. Q23 permanece em implementação. Sem schema ou produção alterados.
