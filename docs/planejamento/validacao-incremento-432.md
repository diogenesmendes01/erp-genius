# Incremento 432 — transferência no portal e impactos de correção

Data: 14/09/2026. Meta integral ativa; frente de impactos em implementação.

## Evidência concluída

Integração real de transferência A→B no mesmo nível aprovada: proposta, decisão e execução de equivalência; fechamento de origem em revisão após a transferência; frequência do nível com duas aulas e duas presenças; novo fechamento do destino com um único resumo por matrícula/nível. Relatório: `docs/validacao-transferencia-portal-432-final-2026-09-14.json` (1/1).

A fixture foi corrigida para cadastrar turma futura antes de iniciar, simular somente a invalidação de cache do Next fora do servidor e conferir a fração exata 200/2, equivalente a 100%. As regras de aprovação, frequência e cálculo não foram relaxadas. TypeScript e ESLint direcionado passaram.

## Frente iniciada e ainda não validada

A identificação de impactos das correções considerava apenas a alocação de origem, sem acompanhar aproveitamentos efetivamente aplicados a vínculos seguintes. Está em implementação um coletor transitivo restrito à mesma matrícula. A projeção da fila foi preparada para identificar solicitações desses vínculos; legados sem matrícula continuam restritos à origem exata.

A regressão direcionada encontrou fixture antiga que inseria solicitação APROVADA sem fechamento, agora recusada corretamente pela migração 195. Relatório: `docs/validacao-fila-correcoes-432-2026-09-14.json` (1 falha; 83 testes fora do filtro, não executados). A fixture está sendo adaptada sem desativar a proteção. Não declarar a fila transitiva aprovada até concluir seus testes e essa regressão.

## Continuidade

Concluir a identificação transitiva, seus testes e as fixtures de correção; depois implementar a resolução persistida das revisões. Correção formal da chamada concluída e demais requisitos da SPEC permanecem pendentes. A verificação do portal não comprova entrega integral nem homologação visual ou de produção.
