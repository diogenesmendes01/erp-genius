# Incremento 572 — ordem de bloqueios da segunda chamada

Corrigida a inversão proposta/calendário em criação de encontro, agendamento, designação docente, decisão de segunda chamada e decisão de prorrogação. A fonte é localizada sem bloqueio apenas para descobrir o vínculo; após bloquear o contexto acadêmico, a proposta é relida com lock e o vínculo é conferido novamente. Permissões, hashes, validade e decisões permanecem verificadas.

Agendamento bloqueia reservas existentes em ordem de ID antes do calendário. A conferência de reserva ativa depois do calendário é uma leitura sem novo bloqueio, evitando inverter a ordem usada por realização, ocorrência e cancelamento. Criação de reserva concorrente continua serializada pelo calendário e proposta; não cria uma segunda reserva vigente. Decisão de prorrogação explicita os aliases bloqueados, sem incluir o lado anulável da decisão.

## Evidências

Cinco cenários direcionados aprovados em `docs/validacao-locks-cinco-fluxos-572-2026-09-15.json`: criação, agendamento, designação, decisão e prorrogação. Uma transação real segura reserva/calendário; o teste verifica no `pg_stat_activity` que a action concorrente está esperando e depois exige a leitura SHARE da proposta, reproduzindo a ordem usada pelo guard de realização. Ambos os caminhos precisam terminar sem deadlock. Agendamento continua recusando reserva duplicada; os demais cenários concluem com sucesso.

TypeScript e lint dos arquivos alterados aprovados. Regressão integrada concluída com 41 testes aprovados, sem falhas, em `docs/validacao-integrada-572-2026-09-15.json`.

## Limites

Os cenários usam uma action real e uma transação SQL representando a aquisição de bloqueios da realização; não representam duas sessões HTTP completas. Os testes de disputa entre fatos terminais do incremento 571 continuam cobrindo realização contra falta/impedimento. Não houve alteração de schema, migration, interface, implantação ou dados reais. A correção não comprova ausência de toda disputa no sistema.

Q164 continua sem resposta: a resolução do impedimento não foi presumida. Proteção de encontros ainda previstos e fluxos próprios de alteração permanecem pendentes. O objetivo global segue ativo.
