# Incremento 566 — conclusão do encontro de segunda chamada

A migration 113000 conclui o encontro vinculado na mesma transação que registra a realização válida. O encontro só passa de PREVISTO para MINISTRADO com a realização exata da reserva consumida, professor correspondente e instante dentro do intervalo. Depois da realização, encontro e ligação de agenda ficam imutáveis. A transição não cria diário, presença, nota ou cobrança.

O processamento de início e a conferência de conclusão da turma passam a considerar apenas encontros AULA. Avaliações de segunda chamada e recuperação não completam carga letiva nem passam a exigir diário de aula por terem status MINISTRADO.

Limites: não reescreve encontros históricos; encontros ainda previstos e os efeitos de falta/cancelamento/impedimento aguardam fluxo próprio, com aprovação independente das alterações de agenda. Ver a pendência de agenda do incremento 565. A revisão de concorrência foi por leitura do código; não equivale a ensaio exaustivo de interleavings. Não houve produção ou validação interativa.

Validação final: 46 integrações aprovadas, sem falhas ou testes pendentes, cobrindo segunda chamada, pendências de fechamento, finalidade e agenda. Evidência: `docs/validacao-final-566-2026-09-15.json`. Lint e TypeScript aprovados. Último build de interface permanece o 565; não houve alteração de interface neste incremento. Migration aplicada somente no banco local de testes.

Os testes verificam conclusão automática, bloqueio de conclusão sem fato, imutabilidade de encontro/ligação e ausência de geração automática de diário, nota ou cobrança. Cenários integrados também verificam que segunda chamada realizada não inicia uma turma planejada, não satisfaz a meta de aulas e não bloqueia a conclusão por falta de diário de aula. Os dois cenários inicialmente falharam na preparação dos dados, foram movidos para o fluxo aprovado de segunda chamada e passaram sem enfraquecer guards.

O incremento não conclui o módulo nem a SPEC geral. A pendência de cancelamento da agenda continua explicitamente aberta.
