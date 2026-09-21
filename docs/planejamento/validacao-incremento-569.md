# Incremento 569 — falta de segunda chamada encerra o encontro

A ocorrência FALTA passa a concluir o encontro vinculado como NAO_REALIZADO. Mantém o consumo da oportunidade previsto em Q148, sem criar nota zero, presença, diário ou cobrança. Reserva, ocorrência e encontro são atualizados na mesma transação. Não foi acrescentada aprovação para registrar a falta factual; cancelamentos continuam seguindo a aprovação independente dos incrementos anteriores.

As migrations 117000 e 118000 adicionam o estado e protegem sua transição: somente encontro PREVISTO com reserva e ocorrência CONSUMIDA_FALTA correspondentes pode recebê-lo, alterando apenas o status. Inserção direta nesse estado, reabertura, exclusão e alteração da ligação são recusadas. As proteções de realização e cancelamento permanecem. Não foi acrescentada regra temporal além das verificações existentes da ocorrência.

As estruturas de replanejamento aceitam o novo estado e preservam o registro sem criar uma aula substituta ou alterar a previsão de término. Telas de agenda/diário e painel de segunda chamada identificam o encontro não realizado. O estado não entra na contagem de aulas regulares ministradas.

## Validação

- 50 integrações aprovadas: segunda chamada, pendências de fechamento, finalidade e rascunho de agenda. Relatório: `docs/validacao-falta-569-2026-09-15.json`.
- 6 testes de replanejamento aprovados, incluindo preservação do encontro não realizado: `docs/validacao-replanejamento-569-2026-09-15.json`.
- Lint dos arquivos alterados e build com verificação de tipos aprovados: `docs/validacao-build-569-2026-09-15.log`.
- Revisão somente leitura do agente Terra não identificou risco concreto nas invariantes ou regressões das transições anteriores.

Prisma regenerado; migrations aplicadas somente no banco local de testes. Sem ensaio interativo, implantação ou migração de dados reais. Impedimento da escola e proteção/alteração de encontros previstos ainda precisam ser concluídos. Este incremento não comprova conclusão do módulo ou da SPEC geral.
