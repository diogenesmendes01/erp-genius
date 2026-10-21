# Incremento 447 — comparação da chamada proposta

Data: 14/09/2026. Meta integral ativa.

A conferência institucional Q23 apresenta conteúdo anterior/novo e, para cada registro, classificação e observação anteriores/novas. A comparação valida o JSON persistido, preserva identidade do registro/aluno/matrícula e inclui o resultado no hash da revisão.

Quando a classificação muda, identifica as reposições da matrícula cuja origem precisa de conferência. Distingue origem que passa a presença de outra mudança de classificação; informa se existe conclusão registrada sem apagar a reposição ou conceder crédito de frequência. Alterar apenas observação não cria esse sinal de classificação.

## Validação

- Seis testes unitários nas suítes de snapshot/comparação aprovados.
- Seis testes de integração aprovados em `docs/validacao-previa-aula-447-2026-09-14.json`.
- Lint direcionado, build e TypeScript aprovados; 62 páginas estáticas geradas.

## Limites

Esta é uma comparação da chamada, não um recálculo da frequência total do nível nem da elegibilidade para progressão. Conclusão registrada não equivale à comprovação da validade atual da reposição. Falta integrar a projeção efetiva, os efeitos financeiros e materiais, decisão/aplicação, casos persistidos e interface. A prévia não publica alterações. Sem migração ou mudança em produção.
