# Incremento 564 — integridade da realização de segunda chamada

A migration 111000 exige, no INSERT da realização, reserva consumida por realização, vínculo exato entre proposta, matrícula, turma, regra e agenda, encontro previsto de segunda chamada e professor aplicador igual ao registrador ativo. Confere atribuição atual e na data do fato, evidência, intervalo do encontro, data posterior à reserva e não futura, além de indisponibilidade docente aprovada. Os guards contratuais anteriores continuam exigindo autorização específica durante pausa/encerramento. Histórico e consistência do consumo permanecem protegidos pela migration 110000.

A ação passa a conferir também atribuição histórica, status do encontro, limite temporal da reserva e indisponibilidade começando exatamente no instante informado. A data de criação de novas realizações é determinada pelo servidor em UTC.

A validação encontrou outro problema: o default da autorização especial gravava horário local do banco em coluna interpretada como UTC. A migration 112000 corrige o default das novas autorizações; não reinterpreta registros legados. O teste usa a conversão UTC explícita no SQL bruto e verifica proximidade da data de criação com o instante real. As duas primeiras execuções falharam nesse cenário; a execução final passou após corrigir tanto o dado de teste quanto o default da autorização.

Validação final: 25 integrações aprovadas, sem falhas, em `docs/validacao-realizacao-final-564-2026-09-15.json`; ESLint e TypeScript aprovados. Inclui negativas de professor/autor incorretos, data futura/anterior, evidência vazia, ausência aprovada, imutabilidade e autorização especial temporal. Prisma Client regenerado. Migrations aplicadas apenas no banco local de testes. Revisão independente Terra não identificou divergência material entre ação e guards de realização.

Não houve alteração de interface, ensaio interativo ou implantação. Último build de interface permanece o 562. Registros temporais legados exigem conferência antes da produção. Cancelamento do encontro na agenda e demais fluxos continuam sujeitos à revisão; esta entrega não comprova conclusão da SPEC geral.

Q160 permanece registrada em FIN-02.3 e no incremento 523: referência contratual explícita para novos vencimentos pela cobertura. A emissão recorrente continua pendente.
