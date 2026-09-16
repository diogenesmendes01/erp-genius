# Incremento 570 — impedimento escolar e seleção de agenda por contrato

A ocorrência PENDENCIA_ESCOLA agora encerra seu encontro como IMPEDIDO_ESCOLA, mantendo a distinção de cancelamento e falta do aluno. As migrations 119000/120000 adicionam o enum e exigem a cadeia exata Agenda/Reserva/Ocorrência; a transição modifica apenas o status de um encontro PREVISTO. Inserção direta, reabertura, exclusão e mudança do vínculo após o impedimento são recusadas. Novas ligações de agenda exigem reserva RESERVADA. Guards anteriores de realização, falta e cancelamento permanecem.

Não houve mudança no cálculo do saldo: impedimento escolar não consome oportunidade. Não há nota, presença, cobrança, nova reserva ou prorrogação automáticas. A pendência da escola continua visível para conferência. A seleção de encontros livres agora filtra matrícula, turma, finalidade, futuro em UTC e ausência de vínculo anterior, em vez de oferecer encontros de outros contratos ou já reservados. O painel identifica o impedimento e remove a duplicação do link de cancelamento.

## Evidências

- 51 integrações passaram na rodada conjunta (`docs/validacao-impedimento-570-2026-09-15.json`); o teste adicional de seleção falhou na preparação dos dados. A repetição da suíte confirmou as outras 30 integrações de segunda chamada (`docs/validacao-segunda-chamada-final-570-2026-09-15.json`).
- A preparação foi corrigida para incluir autorização/disponibilização do outro contrato e outro aluno da mesma turma, respeitando a unicidade atual aluno/turma. O teste de seleção passou isoladamente (`docs/validacao-selecao-570-2026-09-15.json`). Assim, 52 cenários de integração estão aprovados entre as execuções; não houve uma nova rodada integral verde após a última correção exclusivamente na fixture.
- 7 testes de replanejamento aprovados (`docs/validacao-replanejamento-570-2026-09-15.json`).
- Lint direcionado e build com tipos aprovados (`docs/validacao-build-570-2026-09-15.log`).
- Prisma regenerado e migrations aplicadas somente no banco local de testes.

A unicidade legada aluno/turma ainda requer auditoria frente ao modelo de múltiplos contratos; não foi removida incidentalmente para acomodar uma fixture.

## Limitações e próximos passos

A coleta de pendências de fechamento ainda conta toda reserva PENDENCIA_ESCOLA sem uma resolução registrada. É necessário implementar a resolução rastreável e revisar seu efeito no fechamento, preservando o fato original e os fluxos de prazo/agenda. Também seguem pendentes a proteção e os fluxos aprovados de alteração de encontros ainda previstos. Esta entrega não declara esses fluxos concluídos.

Sem ensaio interativo, implantação ou dados reais. Migrations destinadas ao banco local de testes.
