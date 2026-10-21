# Integração 380 — Permissões e datas das reposições

Aplicadas no banco descartável as migrations 174–176: autoria e permissões, isolamento do contrato no pedido e contexto do diário de reposição. A primeira tentativa da 174 falhou por nome de índice invertido; verificou-se que a coluna nova não havia sido criada, registrou-se rollback e reaplicou-se o SQL corrigido. O diff banco/schema após 174 estava vazio.

A rodada mais recente de seis testes direcionados teve **três aprovados e três falhas**, conforme `docs/validacao-reposicoes-permissoes-380-2026-09-14.json`. Passaram a regularização por gravação, a recusa de aprovação por docente/inativo/próprio solicitante e o isolamento de outro contrato do mesmo aluno. Os demais cenários ainda falharam ao preparar o diário particular.

Investigação direta mostrou `inicio = 2026-01-12 07:00:00` em um encontro cujo fixture enviava `10:00Z`, com `TimeZone = America/Sao_Paulo`. O INSERT SQL parametrizado recebia timestamptz e o convertia para timestamp no fuso da sessão, enquanto a gravação Prisma do diário conservava 10h. A proteção de igualdade de horários não deve ser removida. As gravações e comparações temporais da frente estão sendo normalizadas explicitamente, com testes de preservação de instantes.

TypeScript passou antes dessas últimas correções. Nova execução de testes/build e validação do fluxo navegável permanecem pendentes. Agendamento de reposição e identidade do portal do aluno também não estão comprovados. O objetivo integral segue ativo.
