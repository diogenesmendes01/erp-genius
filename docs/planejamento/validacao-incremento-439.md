# Incremento 439 — integridade da correção de reposições

Data: 14/09/2026. Meta integral ativa.

As ações de Q54 conferem fontes, matrícula/aluno, datas e atribuição docente. A aprovação independente exige o hash da proposta e recusa versões superadas. Retirar uma conclusão exige fontes nulas e preserva o registro original; a frequência reflete a retirada somente após aprovação. A migração 200 reforça as verificações no banco e usa defaults UTC para os novos registros de correção/decisão.

## Validação local

- Quatro testes de integração aprovados: correção/retirada com frequência, proposta superada, fontes incompatíveis e professor revogado, rejeição direta no SQL. Relatório: `docs/validacao-correcao-reposicao-439-2026-09-14.json`.
- Regressão do portal aprovada: `docs/validacao-regressao-reposicao-439-2026-09-14.json`.
- TypeScript e lint direcionado aprovados; Prisma Client regenerado. Migração aplicada somente ao banco descartável local.
- A fixture inicialmente tentou inserir uma entrega de aluno alheio e depois saltou uma versão; corrigida para testar a rejeição existente e manter a sequência legítima, sem desabilitar proteções.

## Pendências

Q54 ainda precisa de interface completa e casos persistidos de revisão de progressão afetada. Q23, correção independente de aulas ministradas, permanece pendente. Não houve implantação em produção nem validação interativa de interface neste incremento. Estes testes não comprovam conclusão integral da SPEC.
