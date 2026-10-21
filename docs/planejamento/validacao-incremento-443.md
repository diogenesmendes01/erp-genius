# Incremento 443 — casos de revisão originados em reposições

Data: 14/09/2026. Meta integral ativa.

A aprovação de Q54 persiste o contexto acadêmico e cria, na mesma transação, um caso para cada mudança acadêmica afetada. Repetir a decisão não duplica casos. A migração 202 adiciona a terceira origem com fonte exclusiva e valida matrícula, nível, vínculo histórico e impacto; foi aplicada somente ao banco descartável de testes.

A fila da gestão e o detalhe do caso reconhecem reposições e apontam para a versão correspondente da conclusão. O histórico aprovado apresenta impactos persistidos à gestão; professores não recebem acesso aos casos administrativos. O encaminhamento para regularização utiliza o fluxo existente e mantém a pendência aberta. Nenhuma movimentação do aluno é desfeita automaticamente.

## Validação

- 15 testes aprovados: `docs/validacao-integrada-casos-443-2026-09-14.json`.
- 3 testes de regressão da cadeia de progressão/resolução aprovados: `docs/validacao-regressao-casos-443-2026-09-14.json`.
- TypeScript, lint direcionado e build aprovados; 62 páginas estáticas geradas.
- Revisão independente da migração sem regressão concreta encontrada nos ramos regular/recuperação.

## Limites e continuidade

A fixture de impactos de reposição usa fechamentos e solicitações sintéticos persistidos, com guards ativos. Verifica seleção, criação, isolamento, consulta e encaminhamento; ainda falta combinar esta origem com fechamento real e resolução terminal ponta a ponta. Decisões históricas sem contexto não recebem casos inventados. Q23, validação interativa e outras frentes da SPEC continuam pendentes. Nenhuma implantação em produção foi realizada.
