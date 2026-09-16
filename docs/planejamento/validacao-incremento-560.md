# Incremento 560 — vigência da designação de segunda chamada

As consultas e ações agora usam uma referência única para identificar o professor designado: selecionar a maior versão criada até o instante de referência e só depois conferir início e fim. Se a última designação expirou, a anterior não volta a conceder acesso. Para uma agenda futura, considerar apenas versões já conhecidas hoje. A consulta histórica preserva a atribuição que existia na data da realização, sem antecipar substituições posteriores.

O helper SQL é utilizado na fila/detalhe, registro de realização, nota e agendamento, além das validações de autoria e agenda no banco. O agendamento também confere a vigência do vínculo docente na data do encontro, em vez de aceitar qualquer vínculo antigo.

A regressão identificou que criadaEm da designação era preenchida pelo banco no fuso local, enquanto início/fim eram UTC. A migration 108000 corrige o default para novos registros. Não há deslocamento automático de registros anteriores: eventual histórico legado precisa ser conferido com evidências antes de ser considerado íntegro. A migration 107000 preserva o histórico e introduz a seleção temporal.

Validação final: 13 integrações de segunda chamada aprovadas, zero falhas e zero não selecionados (`docs/validacao-segunda-chamada-final-560-2026-09-15.json`); ESLint e TypeScript aprovados. Migrations aplicadas somente ao banco local de testes. Último build permanece o 559, sem alteração de interface neste incremento. Testes incluem expiração da substituição, negativa de retorno à designação anterior, preservação da atribuição histórica e leitura de agenda futura. O primeiro ciclo expôs a inconsistência de fuso acima e motivou a correção.

Não houve implantação, migração de dados reais ou ensaio interativo. A correção não conclui toda a Q152 nem a SPEC geral. Demais pendências e decisões ainda abertas permanecem explícitas.
