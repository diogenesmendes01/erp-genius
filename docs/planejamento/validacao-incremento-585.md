# Incremento 585 — fila administrativa de segundas chamadas sem agenda

A Secretaria, Gerência Pedagógica e Administração agora localizam fontes aprovadas e disponibilizadas em `/academico/segundas-chamadas/pendentes-agenda`, pelo menu Acadêmico. Cada item encaminha à proposta inicial do incremento 584. A fila não abre notas, evidências pedagógicas nem financeiro; retorna somente identificação, avaliação, prazo e situação necessária ao agendamento.

Fontes com reserva vigente ou realização já consumida não são apresentadas como novas agendas. Outras ocorrências terminais são identificadas, sem conceder saldo ou resolver impedimento escolar. A interface destaca impedimento escolar pendente e a exigência de autorização específica para matrícula pausada/encerrada. A prévia continua obrigatória para confirmar condições e disponibilidade.

O prazo incorpora somente a última prorrogação aprovada. Nome preferido prevalece sobre a composição do nome cadastral. A consulta usa cursor por criação/id e valida a fonte aprovada/disponibilizada mesmo quando ela já saiu da fila após agendamento, evitando perda de continuidade entre páginas. A consulta adquire o bloqueio de calendário antes da seleção para manter coerência com as conferências atuais de estado.

## Evidências

- 11 testes de integração passaram, sem falhas: `docs/validacao-integrada-585-2026-09-15.json`. Incluem acesso da Secretaria, recusa de professor/usuário desativado, projeção mínima, permanência da proposta pendente e retirada após aplicação, paginação com entrada nova e agendamento da fonte usada como cursor, nome preferido e prazo prorrogado somente após aprovação.
- Cinco testes de renderização passaram: `docs/validacao-unitaria-585-2026-09-15.json`.
- Lint direcionado aprovado: `docs/validacao-lint-585-2026-09-15.log`.
- Build com conferência de tipos aprovado, incluindo a nova rota: `docs/validacao-build-585-2026-09-15.log`.
- Na primeira integração, a consulta referenciava `Aluno.nome`, inexistente no modelo. A correção usou os campos reais e foi validada pela execução final. TypeScript sozinho não validava esse SQL.

## Fechamento SQL ainda pendente

A auditoria desta rodada confirmou a necessidade de bloquear novos encontros de segunda chamada sem cadeia de aprovação. A origem inicial deve corresponder à decisão/aplicação do 584; a remarcação deve continuar criando seu novo encontro pela cadeia própria, sem reutilizar indevidamente a origem inicial. Encontros vinculados precisam impedir mudanças diretas de professor, datas, turma e matrícula, além de exclusão; as transições de status devem continuar pelos guards de realização, falta, cancelamento e impedimento.

Não foi criada migration 126 nesta rodada. Os testes históricos ainda criam encontros pelo caminho interno legado e alguns avançam o tempo alterando o encontro: precisam migrar para fontes e fatos válidos antes de fechar a transição, sem adicionar uma exceção SQL apenas para fazer fixtures passarem. Uma indicação de profundidade de trigger isolada não comprova cadeia aprovada; a origem/decisão e a integridade final também devem ser verificadas.

Não houve validação interativa, implantação ou importação de dados reais. Q164 continua pendente e o objetivo integral permanece aberto.
