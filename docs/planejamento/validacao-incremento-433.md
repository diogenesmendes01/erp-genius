# Incremento 433 — impactos transitivos de correção

Data: 14/09/2026. Meta integral ativa.

## Implementação

Correção regular e de recuperação agora identificam progressões potencialmente afetadas ao percorrer aplicações de equivalência A→B→C. O coletor exige origem da matrícula informada, percorre somente aplicações aprovadas com proposta, origem e destino coerentes na mesma matrícula, usa visitados e devolve referências ordenadas. Solicitações comuns de mudança de nível não são arestas de aproveitamento. Legados sem matrícula conservam somente a revisão direta da origem exata.

A fila reconhece referências em outros vínculos da mesma matrícula. Os impactos continuam registrados nas decisões e eventos existentes; não desfazem progressão nem alteram alocação. A busca é conservadora por vínculo: não prova que cada nota mudou, inclusive quando existe nota local prevalente. A resolução persistida da revisão permanece pendente.

## Evidências

- Regressão de lançamentos: 83/84 passaram inicialmente. `docs/validacao-correcoes-transitivas-433-2026-09-14.json`.
- A fixture restante passou após direcionar o plano de recuperação à habilidade insuficiente. A execução direcionada também aprovou os dois casos novos A→B→C, com progressão APROVADA e EXECUTADA, proposta rejeitada sem aplicação e origem incompatível com a matrícula. `docs/validacao-impactos-transitivos-433-final-2026-09-14.json`: 3 aprovados e 83 fora do filtro. Os 83 anteriores não foram repetidos nessa execução.
- As fixtures de progressão agora têm fechamento suficiente real. A cadeia usa avaliações posteriores ao início do vínculo de destino; respostas de ações sem payload são verificadas pelo sucesso, sem exigir dado inexistente. As regras de produção não foram relaxadas.
- TypeScript e ESLint direcionado aprovados; build completo aprovado nesta rodada com 62 páginas estáticas. Sem migração ou produção.

## Limites

Falta resolução persistida dos casos, com decisão e histórico, e fluxo formal de correção da chamada concluída. A prova de exclusão de outro contrato inclui a rejeição da origem incompatível; a solicitação isolada adicional do outro contrato está pendente, não aprovada. Os testes da cadeia demonstram o alcance conservador por aplicações, não a análise fina de dependência de cada nota. A SPEC integral continua em implementação.
