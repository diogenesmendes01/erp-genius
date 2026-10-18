
# Task 31 — Funil e pipeline

Arquivos: src/server/relatorios/{funil.ts,pipeline.ts,funil-pipeline.int.test.ts}.

## O que foi feito
- `pipeline.ts`: `FiltrosRelatorio`, `condicoesLead` (escopo + responsavelId/origem/temperatura/autor, tudo parametrizado), `metricasPipeline` ($queryRaw; moeda = `Pais.moedaLocal`, nunca soma moedas; sem valor ou sem país = `semValor`).
- `funil.ts`: `metricasFunil` com CTE SQL que reconstrói a linha do tempo de etapa a partir de Evento (EtapaAlterada.para, PropostaEnviada, ExperimentalAgendada/Realizada, NoShow, LeadPerdido; NOVO na criação), colapsando repetições.
- Testes TDD (11, 6 do brief + extras).

## Testes
- `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/relatorios/funil-pipeline.int.test.ts` : 11 passed (banco dev-gravacoes).
- tsc --noEmit: 0. eslint src/server/relatorios: 0. vitest unit src/server/relatorios: 6 passed. npm test completo não rodado (sem código compartilhado alterado).

## Decisões / desvios
- Sem migration, sem alteração de código existente.
- Semânticas definidas por mim (brief ambíguo): `chegaram` = entrou na etapa (ou além, contando puladas) com a entrada dentro do período; `agora` = retrato atual no escopo; `conversaoProxima` = das que entraram na etapa no período, parcela que já chegou à seguinte; `tempoMedioDias` = soma das visitas encerradas (idas e voltas), média por oportunidade; etapas = linha principal de 8 (NO_SHOW conta como EXPERIMENTAL_AGENDADA para "chegou", PERDIDO fora).
- Pipeline: `abertas` = etapa fora de MATRICULADO/PERDIDO; `criadas` por criadoEm; `ganhas` = evento EtapaAlterada para MATRICULADO no período; `conversao` = coorte (criadas no período hoje MATRICULADO / criadas), null sem criadas; `ticketMedio` por moeda das ganhas; `cicloMedioDias` criação->matrícula.
- Perda: LeadPerdido não grava a etapa de origem; etapa = visita anterior na linha do tempo. Motivo ausente vira OUTRO.
- `autor`: ARIA = oportunidade com AcaoAgenteIA EXECUTADA/APROVADA; EQUIPE = sem. Só testado o caso sem ações (criar AcaoAgenteIA exige turno/atendimento).
- Comparações de data usam `${d}::timestamptz AT TIME ZONE 'UTC'` (idioma do repo).
