# Incremento 581 — disponibilidade na segunda chamada

A criação e o agendamento inicial de segunda chamada agora conferem conflitos do aluno e do professor, aulas coletivas das turmas com vínculo no intervalo, indisponibilidade docente aprovada e reservas comerciais vigentes. O agendamento repete a conferência antes de reservar a oportunidade, ignorando somente o encontro escolhido. As ações mantêm a trava global de calendário de `bloquearLancamento`; a criação reconhece reenvio idêntico antes de tratar uma nova solicitação.

O filtro compartilhado de disponibilidade também foi corrigido: o ramo de turma considera somente encontros coletivos (`matriculaId: null`). Uma segunda chamada individual de outro aluno, com outro professor, não ocupa a agenda de todos os colegas. Os encontros do próprio aluno continuam sendo conferidos por pessoa, inclusive em contratos distintos; o professor continua sendo conferido independentemente da matrícula.

## Validação

- Primeira execução: 56 integrações aprovadas, sem falhas, em segunda chamada e pendências de fechamento. Relatório: `docs/validacao-integrada-581-2026-09-15.json`.
- Cenários novos verificam conflito na criação, conflito surgido antes da reserva e preservação do saldo quando a reserva é recusada. A fixture de encontros adjacentes foi corrigida para não exigir dois compromissos simultâneos como se fossem válidos.
- Teste unitário do filtro compartilhado, lint direcionado e TypeScript aprovados; relatórios/logs `validacao-unitaria-581`, `validacao-lint-581` e `validacao-types-581`, de 15/09/2026.
- Depois da correção do filtro compartilhado, a suíte principal passou 53 casos e apontou uma falha na preparação do novo teste: o encontro do colega não tinha uma avaliação aprovada/disponibilizada. A fixture foi completada respeitando a regra do banco. A execução direcionada seguinte aprovou 24 cenários de agenda/conflito/substituição em segunda chamada, recuperação e reposição, incluindo o isolamento entre colegas. Os 136 testes fora do filtro não foram executados nessa rodada. Relatórios: `docs/validacao-isolamento-581-2026-09-15.json` e `docs/validacao-agendas-581-2026-09-15.json`. Não somar execuções sobrepostas como testes distintos.

## Limites

Esta rodada não acrescenta migration. As conferências novas são das ações de servidor; não equivalem a uma restrição SQL completa contra escrita direta. Calendário e exceção de dia não letivo na entrada original, atribuição docente durante todo o intervalo e proteção integral de encontros previstos permanecem pendentes. Q164 também continua sem decisão. Nenhuma implantação, migração de dados reais ou validação visual interativa foi realizada.

Q160 permanece registrada em FIN-02.3 da SPEC: a referência do vencimento vem expressamente do contrato. Configuração e cálculo existem, mas a emissão recorrente ainda não está concluída.
