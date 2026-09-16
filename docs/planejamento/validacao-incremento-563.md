# Incremento 563 — integridade das ocorrências e reservas de segunda chamada

A migration 110000 protege o histórico de ocorrências e realizações contra atualização/exclusão. A reserva preserva seus dados de origem, incluindo antecedência de cancelamento e data de criação; permite somente transição de reservada para um resultado terminal. Nova reserva exige gestão ativa, estado inicial correto e antecedência exatamente igual à regra acadêmica aplicável.

Ao inserir ocorrência, o banco confere gestão ativa, conteúdo, data, início da agenda para falta e antecedência para cancelamento tempestivo/tardio. Recusa duplicidade de fato terminal e determina a data de criação em UTC. Um constraint trigger diferido exige, ao concluir a transação, exatamente uma realização ou uma ocorrência compatível com o estado terminal. Alterar apenas o status sem gravar o fato não confirma consumo ou liberação.

Os defaults de reserva e ocorrência passaram a UTC, sem reinterpretar dados anteriores. A transação de registro foi isolada em módulo interno, compartilhado pela ação e pelos testes; mantém a conferência da gestão dentro da transação. A ação pública conserva a exigência de sessão.

Validação final: 24 integrações aprovadas, zero falhas e zero não selecionados (`docs/validacao-guards-final-563-2026-09-15.json`). ESLint e TypeScript aprovados. Os cinco resultados de ocorrência passaram pelo envio concorrente na transação, retornando um único registro e evento. Negativas SQL e pendências de fechamento também passaram. A migration foi aplicada somente no banco local de testes. Último build de interface permanece o 562. O primeiro ciclo comprovou as negativas SQL, mas a tentativa de duas ações simultâneas falhou antes do banco por importação de NextAuth no ambiente de mocks. A concorrência passa a ser exercitada diretamente na mesma função transacional usada pela ação; autorização e reenvio da ação continuam cobertos separadamente.

Não houve produção, migração de dados reais ou ensaio interativo. A integridade completa das realizações, cancelamento do encontro na agenda e demais fluxos permanecem sujeitos à revisão. Este incremento não comprova conclusão da SPEC geral.
