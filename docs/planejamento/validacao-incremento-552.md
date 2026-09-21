# Incremento 552 — histórico de autorizações de realização

O histórico de autorizações específicas de recuperação passa a carregar vinte registros por página, preservando a ordem de criação decrescente e o desempate pelo identificador. A navegação permite consultar autorizações mais antigas e voltar à primeira página. O cursor precisa pertencer à tentativa consultada; referência inexistente ou de outra tentativa é recusada. Permissões, prazo e critérios para autorizar permanecem inalterados.

Consulta e interface implementadas pelo agente Terra, revisadas pelo orquestrador. Teste integrado percorre 21 autorizações, compara a sequência completa com a ordem persistida, verifica ausência de duplicação e recusa cursor estranho e acesso docente. A resposta continua omitindo snapshot, hash e chave de idempotência. Os dois testes direcionados passaram; relatório em `docs/validacao-historico-realizacao-552-2026-09-15.json`. ESLint focado e build aprovados (`docs/validacao-build-552-2026-09-15.log`). Regressão completa de lançamentos acadêmicos concluída: 96 testes aprovados, zero falhas e zero não selecionados (`docs/validacao-academica-552-2026-09-15.json`). Isso comprova esta suíte, não a implementação integral do projeto.

## Decisão Q163 pendente

Foi solicitado ao usuário definir se uma autorização concedida durante a pausa continua válida depois do encerramento da matrícula: exigir nova autorização, conservar a autorização até o prazo original ou configurar esse alcance no momento de autorizar. Nenhuma alternativa foi presumida. A diferença documentada no incremento 549 continua pendente de decisão e implementação; este incremento não muda essa regra.

A implementação geral e a validação interativa continuam pendentes. Nenhuma alteração em produção.
