# Incremento 586 — proteção da origem e dos encontros de segunda chamada

A migration 126 fecha o caminho de criação de encontros de segunda chamada sem aplicação aprovada. O banco exige a cadeia da agenda inicial ou da remarcação e confere, ao concluir a transação, seus vínculos de decisão, aplicação, reserva e agenda. Profundidade de trigger isolada não basta.

Os dados e a origem do encontro ficam imutáveis, inclusive para registros antigos. Exclusão e mudança direta de horário, professor, turma, matrícula ou finalidade são recusadas. As transições de realização, falta, impedimento escolar e cancelamento continuam exigindo os fatos correspondentes; a remarcação preserva o encontro anterior e aplica o novo encontro pela decisão aprovada.

As funções legadas de criação e agendamento separados foram retiradas depois de migrar seus consumidores para a proposta e decisão atômicas. Os testes passam a construir agendas pelo fluxo real; realização aguarda o início do encontro, sem adulterar datas nem desabilitar proteções.

## Validação concluída — 16/09/2026

- 12 integrações de agenda inicial aprovadas: `docs/validacao-integrada-inicial-586-2026-09-15.json`.
- Três integrações de pendências de fechamento aprovadas: `docs/validacao-integrada-pendencias-586-2026-09-15.json`.
- Oito testes de schema e renderização aprovados: `docs/validacao-unitaria-586-2026-09-15.json`.
- Rodada final conjunta: **72 testes de integração aprovados, zero falhas e zero ignorados** — 57 da suíte principal, 12 da agenda inicial e três de fechamento: `docs/validacao-integrada-final-586-2026-09-16.json`.
- Cinco cenários de ordem de bloqueios e nove ajustes de fixtures também passaram nas execuções direcionadas, antes da rodada conjunta. As contagens não devem ser somadas à rodada final, pois repetem os mesmos casos.
- Treze testes de schemas/paginação de segunda chamada aprovados: `docs/validacao-unitaria-completa-586-2026-09-15.json`. Parte deles também aparece na execução de oito testes acima; não somar como casos únicos.
- Build e checagem de tipos aprovados: `docs/validacao-build-586-2026-09-16.log`.
- Lint direcionado aprovado: `docs/validacao-lint-586-2026-09-16.log`.
- Revisão independente conferiu a compatibilidade da migration 126 com realização, falta, impedimento, cancelamento e remarcação; a regressão exercitou esses caminhos no banco descartável.

A primeira execução de pendências detectou proponente/decisor coincidentes na fixture e horários de professor sobrepostos. Foram corrigidos usando pessoas distintas e horários sem conflito, mantendo a proteção de produção. A primeira compilação ocorreu durante edição do helper principal e detectou IDs anuláveis; foi corrigida e a compilação final passou. A primeira suíte principal teve 46 aprovações e 11 falhas: duplicação de configuração/calendário, instantes de cancelamento anteriores à reserva e expectativas legadas sobre criação, aprovação, autoria e reenvio. Foram corrigidas as fixtures, preservando os 57 casos; a rodada final passou integralmente.

Sem homologação interativa, produção ou importação de dados reais. Q164 continua pendente; emissão financeira recorrente e o objetivo integral permanecem abertos. A referência contratual de vencimento Q160 já está registrada na SPEC principal, sem presumir valor para contratos incompletos.

## Equivalência dos testes migrados

A lista de encontros avulsos deixou de existir no produto; sua entrada foi substituída pela fila de fontes aprovadas e disponibilizadas do incremento 585. A concorrência de aprovação inicial está na suíte de agenda inicial. Cancelamento desatualizado é testado com remarcação válida posterior à proposta; a proteção direta de campos não é usada como substituto desse cenário. A conferência de prazo, cobertura docente integral, isolamento de avaliações individuais e conflitos permanece na suíte principal. Reenvio histórico utiliza o payload da proposta original, sem refazer a prévia depois do horário.

A migration 126 foi aplicada somente ao PostgreSQL descartável em localhost:54329. Migrações anteriores aplicadas não foram reescritas. O relatório abrangente 574 permanece histórico e não comprova regressão integral do restante do ERP após esta alteração.
