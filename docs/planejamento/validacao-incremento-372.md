# Incremento 372 — Impactos das recuperações, 14/09/2026

## Alteração

A conferência de replanejamento do calendário distingue particulares de recuperações. Recuperações previstas futuras têm coleção própria, participam da memória de revisão e exigem conferência de horários, avaliadores e prazos. A revisão atual e sua consulta histórica apresentam essa distinção. Os controles comuns de conflito continuam considerando todas as finalidades.

As origens acadêmicas do encerramento também distinguem encontros de recuperação. Uma recuperação prevista que ultrapasse o limite contratual gera pendência acadêmica específica, sem entrar na apuração de horas contratadas, nos destinos financeiros ou no consumo presumido de oportunidades. Rascunhos não representam agendamento confirmado.

As novas coleções são opcionais e só aparecem quando não vazias. Memórias antigas sem recuperações mantêm seu formato; não houve reescrita de históricos. A leitura de snapshots preserva a nova coleção quando existente e a detecção de alterações considera seus horários.

## Validação

28 integrações em três arquivos aprovadas no banco descartável: finalidade dos encontros, rascunhos da agenda e solicitação de encerramento. [Relatório](../validacao-impactos-recuperacao-372-2026-09-14.json). O novo teste compara origens anteriores e posteriores ao rascunho de recuperação e verifica ausência de cobrança. Para conferir o tratamento de uma recuperação prevista, usa uma projeção em memória; não publica recuperação nem contorna a proteção SQL.

Dois unitários do parser e da detecção de alterações aprovados. TypeScript, lint dos oito arquivos alterados e build com 52 páginas estáticas aprovados. A fixture unitária foi ajustada aos tipos reais da revisão; não houve flexibilização dos tipos de produção.

A regressão completa mais recente permanece a do incremento 371, anterior a estas alterações. Nesta rodada foram executadas as verificações direcionadas descritas acima. Não houve migration, alteração de produção, envio externo ou homologação interativa.

## Limites

A publicação de recuperação continua bloqueada pela migration 164. Ainda faltam decisão independente com origem verificável e publicação atômica, os fluxos de remarcação/cancelamento e a autorização acadêmica específica após pausa/encerramento. Esta mudança prepara os consumidores e sinaliza pendências; não implementa Q151 integralmente nem a aplicação conjunta do replanejamento global. O objetivo completo permanece em implementação.
