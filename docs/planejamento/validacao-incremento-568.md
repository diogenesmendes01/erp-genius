# Incremento 568 — cancelamento do aluno com aprovação e antecedência

A proposta de cancelamento de segunda chamada identifica origem ESCOLA ou ALUNO. O cancelamento do aluno exige revisão e aprovação independente, com snapshot da agenda. A migration 116000 classifica o efeito pela data original do pedido e pela antecedência congelada na reserva: no limite ou antes dele libera a oportunidade; após o limite consome, sem gerar nota zero. O instante da aprovação não altera esse cálculo.

Reserva, ocorrência e encontro são aplicados na mesma transação. Os três estados de cancelamento exigem a proposta e a decisão correspondentes; cancelamento direto pela ação antiga ou SQL é recusado. Encontro cancelado e ligação são preservados. Propostas anteriores recebem origem escolar; inputs antigos que omitem origem mantêm o hash de idempotência.

A tela conserva revisão da agenda, identificação da matrícula, decisão independente, paginação e trava de envio. Inclui origem obrigatória no formulário, antecedência e efeito proposto na revisão. Uma edição intermediária da interface removeu esses controles existentes; foi corrigida antes da validação final. Não houve redução do fluxo de aprovação.

Validação: 31 integrações aprovadas, sem falhas ou pendentes, em `docs/validacao-cancelamento-aluno-568-2026-09-15.json`. Cenários de um milissegundo antes, no limite e um milissegundo após conferem liberação/consumo pela data do pedido mesmo com aprovação posterior. Inclui negativas SQL, reenvio, troca de origem com mesma chave, imutabilidade, contagem da oportunidade, ausência de nota/cobrança e regressão do cancelamento escolar. Lint e build com TypeScript aprovados (`docs/validacao-build-568-2026-09-15.log`). Prisma regenerado; migration somente no banco local de testes.

Não houve ensaio interativo ou implantação. Falta e impedimento da escola ainda exigem integração do encerramento do encontro; proteção de encontros previstos e fluxos de alteração permanecem pendentes. Este incremento não comprova conclusão do módulo ou da SPEC geral.
