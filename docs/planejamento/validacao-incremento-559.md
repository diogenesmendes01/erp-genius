# Incremento 559 — regularização de nota da segunda chamada por outro professor

Q152: depois da realização da segunda chamada, a gestão pode usar a designação específica da avaliação para atribuir a regularização da nota a outro professor. A ação e a consulta exigem o registro da matrícula, alocação, turma, regra e código correspondentes e a designação mais recente. A designação não concede acesso à turma inteira nem permite registrar outra realização do encontro.

A nota conserva o professor que aplicou a avaliação e sua data original; identifica separadamente o autor do lançamento, motivo e evidências. O realizador pode estar desativado hoje, desde que sua atribuição histórica esteja comprovada. O regularizador precisa continuar ativo e designado, inclusive nos reenvios. O registro permanece sujeito à conferência por outra pessoa, sem autoaprovação por acúmulo de papéis.

A fila e o detalhe docente apresentam a pendência atribuída e o nome do realizador; o formulário exige motivo e evidências. A gestão tem um atalho para a designação na página da segunda chamada. A revisão corrigiu a precedência dos filtros de acesso para respeitar o identificador solicitado e o cursor, e manteve a escolha da última designação histórica antes da comparação com o professor.

Backend e interface preparados por dois agentes Terra, com revisão e testes pelo orquestrador. As migrations 105000 e 106000 preservam as validações comuns e acrescentam o caso de regularização da segunda chamada persistida. A migration 105000 permanece com o checksum aplicado, e o refinamento posterior fica em 106000.

Validação final: 108 testes de integração de lançamentos e segunda chamada aprovados, zero falhas e zero não selecionados (`docs/validacao-academica-final-559-2026-09-15.json`). ESLint focado e build aprovados (`docs/validacao-build-559-2026-09-15.log`). O primeiro ciclo encontrou falha de paginação; a consulta foi corrigida e o teste ampliado para incluir identificador não autorizado e cursor do regularizador.

Não houve ensaio interativo, produção, envio externo ou migração de dados reais. Não representa conclusão de Q152 em todos os fluxos ou da SPEC geral. Q163 continua pendente, sem mudança presumida na autorização entre estados contratuais.
