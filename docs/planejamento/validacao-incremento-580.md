# Incremento 580 — prazo integral e reenvio da criação de segunda chamada

## Correções

A criação e o agendamento conferiam somente o início do encontro contra o prazo da disponibilização. Um encontro podia começar dentro do prazo e terminar depois dele. Agora os dois caminhos exigem início futuro, fim posterior ao início e término menor ou igual ao prazo vigente, incluindo a última prorrogação aprovada. Terminar exatamente no limite é permitido.

A migration `20260915123000_prazo_integral_agenda_segunda_chamada` acrescenta a mesma conferência ao guard da ligação entre agenda e reserva, preservando contexto e atribuição docente existentes. Obtém a fonte exata da reserva e respeita a ordem reserva → calendário → fonte/encontro. A proteção também é executada ao religar a agenda durante remarcação. Não editar a migration após a aplicação realizada nesta rodada ao banco local descartável.

O reenvio idêntico da criação de encontro agora é reconhecido antes de validar o relógio de uma nova criação, depois das conferências de contexto, acesso e hash. O horário ter passado não transforma uma repetição em erro. Outra chave não autoriza criar no passado; a mesma chave com dados diferentes continua recusada.

## Evidências

- 51 testes de integração de segunda chamada aprovados, zero falhas e zero pendências: `docs/validacao-integrada-580-2026-09-15.json`.
- O teste do limite demonstra recusa na criação, aceitação do término exato, reconferência no agendamento e rollback de inserção direta no banco fora do prazo, sem reservar oportunidade. Após tornar a asserção SQL específica para a mensagem de prazo, o cenário passou novamente: `docs/validacao-prazo-sql-580-2026-09-15.json`.
- O teste de repetição avança somente o relógio Date da aplicação, preserva uma única criação e recusa tanto nova solicitação passada quanto reuso de chave com conteúdo diferente.
- TypeScript (`docs/validacao-types-580-2026-09-15.log`) e lint direcionado passaram. Não houve mudança de interface nesta rodada; o build anterior não é apresentado como nova execução.

## Auditoria da entrada original da agenda — ainda incompleta

Revisão de código por agente Terra e conferência local identificaram que criar/agendar inicialmente a segunda chamada ainda não aplicam todas as verificações presentes na remarcação. Permanecem calendário/dias não letivos, conflito de professor/aluno/turma/reserva comercial e conferência da atribuição docente durante todo o intervalo. A aprovação da avaliação pendente não constitui evidência de uma exceção específica para qualquer horário futuro escolhido.

Os guards existentes de contexto e docente não equivalem a essas verificações. O guard novo trata prazo e fonte; não declara resolvidas as demais lacunas. Atualizações diretas de encontros previstos também precisam de proteção integral, além da proteção do relink já existente. O próximo trabalho deve completar a entrada da agenda sem presumir autorização de exceção ou ignorar conflitos, com fluxo e testes correspondentes.

Nenhum dado real foi importado, nenhuma implantação foi realizada e o objetivo integral permanece aberto.
