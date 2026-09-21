# Integração 381 — Reposição e regressão acadêmica

A rodada ampliada de 14/09/2026 passou em **113 testes de integração, distribuídos em cinco arquivos**, sem falhas ou omissões: avaliações, frequência com reposições, diário, finalidade dos encontros e permissões de reposição. Relatório: `docs/validacao-integracao-academica-381-2026-09-14.json`.

Antes dela, os seis testes focados passaram em `docs/validacao-reposicoes-permissoes-381-2026-09-14.json`. A correção temporal conserva instantes UTC no encontro, na entrega e na validação. Ajustou-se também o teste de gravação para consultar sua própria entrega, sem exigir um encontro particular inexistente naquele cenário.

Build integrado passou com TypeScript e 54 páginas estáticas, incluindo as novas rotas de equipe/docente no resultado da compilação. Isso não comprova as consultas da interface em execução nem substitui sua revisão de permissões. Lint dos módulos de frequência e reposição e `git diff --check` também passaram.

A evidência cobre regularização de frequência por fontes persistidas autorizadas, preservação de falta/impedimento, correções, isolamento entre contratos, pausa e designação docente. A cadeia de substituição e o bloqueio de aprovação direta após correção acadêmica continuam passando. As regras de diário e de finalidade existentes passaram na mesma execução.

## Limites e continuidade

Os testes de reposição ainda preparam parte das fontes diretamente no banco. Não comprovam agendamento comercial/pedagógico completo, benefício por plano, convite/login do aluno ou envio de resumo no portal. Essas entregas estão em implementação própria. A consulta da equipe também precisa preservar correções aprovadas e vincular cada encontro ao pedido correspondente, sem selecionar qualquer encontro da mesma matrícula.

Não houve produção, envio externo ou homologação interativa. Esta rodada é uma regressão direcionada, não a regressão integral de todas as frentes da SPEC.
