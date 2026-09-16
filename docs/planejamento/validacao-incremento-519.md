# Incremento 519 — fonte confirmada para compensação de cobertura

15/09/2026. Agentes Terra implementaram apuração, proteção no banco e interface; o orquestrador integrou e testou.

O fluxo de compensação existente permitia reconhecer dias sem fonte pedagógica confirmada. Agora preparação e aprovação conferem os relatos positivos da mesma matrícula, aplicam términos aprovados e unem dias sobrepostos sem duplicação. Cada dia solicitado precisa pertencer à cobertura original e à indisponibilidade confirmada. Relatos abertos valem até o fim da cobertura consultada. A apuração não usa a projeção de histórico limitada a 20 registros.

Se todos os dias da cobertura estiverem indisponíveis, a compensação parcial fica bloqueada mesmo que o solicitante selecione apenas alguns dias. O caso continua exigindo a escolha contratualmente permitida entre crédito/cobertura futura de Q67. A nova migração protege INSERT aprovado e transição para aprovado; rejeitar uma proposta antiga continua permitido. Direitos anteriormente aprovados não são apagados ou reclassificados.

Calendário, matrícula e cobrança são bloqueados antes de conferir a fonte; papel ativo é relido com bloqueio do usuário. Se um término aprovado retirar um dia da fonte entre preparação e decisão, a aprovação falha e a proposta pode ser rejeitada para nova conferência.

A página `/matriculas/[id]/compensacoes/[cobrancaId]` permite ao Financeiro/Administração consultar dias, propor o direito e aprovar/rejeitar com as permissões já definidas. A ficha financeira oferece link na linha da mensalidade com cobertura. Dias com direito já reconhecido não ficam disponíveis para nova seleção. A aprovação cria direitos; a execução de recomposição e seu cumprimento continuam em seus fluxos separados.

## Validação

- Migração 790 aplicada somente ao banco descartável; nenhuma mudança em produção.
- Dezessete integrações aprovadas nas suites de fonte, compensação/recomposição e encerramento: `docs/validacao-integracao-519-2026-09-15.json`.
- Quatro casos de fonte revalidados após acrescentar verificações da consulta: matrícula cruzada, visibilidade da decisão e dias já reconhecidos (`docs/validacao-fonte-consulta-519-2026-09-15.json`). Não são quatro casos adicionais à regressão acima.
- ESLint focado e build aprovados (`docs/validacao-build-519-2026-09-15.log`).
- As fontes sintéticas das suites existentes foram explicitadas; não se usou ausência de relato como comprovação. Dois casos iniciais usavam versão zero presumida da cobrança e foram corrigidos para ler a versão real da fixture antes da rodada aprovada.

## Limites

A consulta calcula até 366 dias por cobertura e exige conferência específica acima de 1000 relatos candidatos, sem autorizar resultado truncado. O fluxo mensal integral de Q67 e a emissão recorrente não ficam concluídos por esta entrega. Interface sem ensaio interativo; bloqueio de inicialização local permanece documentado no incremento 518. Retificação Q157 continua pendente. A SPEC integral permanece em implementação.
