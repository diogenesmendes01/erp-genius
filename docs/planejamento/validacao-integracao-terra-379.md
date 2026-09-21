# Integração 379 — Fontes acadêmicas e reposições

Em 14/09/2026, a execução integrada passou em todos os **84 testes de `lancamentos.int.test.ts`**. Isso inclui a cadeia de substituições, preservação de acesso e o novo teste que recusa uma inserção direta de aprovação após correção da nota que fundamentou o plano.

A mesma execução falhou nos **três testes novos de `frequencia-integracao.int.test.ts`**. Dois tentam registrar diário de uma reposição, ainda bloqueado pela proteção que aceita apenas encontros de aula. O terceiro encontrou uma variável ausente no fixture. Relatório completo: `docs/validacao-integracao-reposicoes-379-2026-09-14.json`. A execução conjunta não está aprovada.

A migração `20260914234000_regularizacao_reposicao` foi aplicada apenas no banco descartável e o cliente Prisma foi gerado. O schema foi posteriormente ajustado para autoria da conclusão e unicidade da entrega original. Esses últimos ajustes dependem da migração corretiva `20260915000000_regularizacao_reposicao_guardrails`, ainda em revisão nesta evidência. Não declarar equivalência final entre banco/schema até aplicar e conferir novamente.

Foram acrescentados testes adversariais em `src/server/diario/reposicao-permissoes.int.test.ts`, ainda sem execução: aprovação por docente/inativo, autoaprovação, outro contrato, pausa e falta de designação. O fluxo de reposição continua exigindo integração do registro particular, fontes de entrega do aluno, permissões e interface navegável. Identidade e acesso autenticado do aluno não estão comprovados por esta rodada.

Build anterior passou com 52 páginas estáticas; será necessário repetir após estabilizar os novos arquivos. Não houve produção nem envios externos. O objetivo integral permanece aberto.
