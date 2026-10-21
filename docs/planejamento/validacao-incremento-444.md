# Incremento 444 — resolução de revisão de reposição com fechamento real

Data: 14/09/2026. Meta integral ativa.

A suíte `impactos-progressao-tx.int.test.ts` agora combina a reposição com avaliações oficializadas, equivalências aplicadas, fechamento calculado pelas ações do sistema e progressão aprovada/executada. Os dados iniciais de aula, entrega e conclusão são fixtures persistidas com os guards ativos; fechamento, progressão, correção e resolução não são simulados.

O cenário corrige o instante de validação mantendo a reposição concluída. A aprovação cria um caso, invalida a suficiência do fechamento antigo para reconfirmação e exige novo fechamento calculado. A resolução terminal recusa autoaprovação e, após aprovação independente, marca o caso resolvido. Conclusão original e movimentações permanecem iguais às anteriores.

## Evidências

- Quatro testes aprovados, incluindo três regressões e o novo cenário: `docs/validacao-progressao-reposicao-444-2026-09-14.json`.
- TypeScript e lint do arquivo aprovados. Somente testes/documentação alterados neste incremento; build de produção aprovado no incremento 443.

## Limites

Este cenário cobre correção que mantém a regularização. A retirada que torna a frequência insuficiente e sua posterior solução acadêmica ainda precisam de cenário completo combinado. Não comprova o fluxo Q23 de correção de aula ministrada nem validação interativa. Nenhuma produção foi alterada.
