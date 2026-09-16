# Incremento 435 — alcance validado e consulta da revisão

Data: 14/09/2026. Meta integral ativa.

## Implementação

A migração 197 acrescenta um guard de inserção que comprova o alcance entre a alocação fonte e a origem da solicitação. Aceita a origem direta ou a cadeia de equivalências efetivamente aplicadas, com decisão aprovada, proposta, matrícula, turmas e alocações coerentes. A recursão elimina repetidos para terminar em caso de ciclo. Solicitação legada sem matrícula continua limitada à origem direta. A migração 196 foi preservada.

A fila oferece consulta individual dos casos persistidos. A página mostra aluno/matrícula, tipo e data da correção, turmas e estados histórico/atual da solicitação. A consulta revalida o papel ativo da Gestão Pedagógica/Administração no servidor e retorna campos explícitos. A Secretaria não recebe esse acesso. Mudar o estado da solicitação não resolve automaticamente o caso.

## Evidências

- Dois casos de correção regular/recuperação passaram com persistência, replay, consulta pela gestão e negativa de acesso da Secretaria: `docs/validacao-consulta-casos-435-2026-09-14.json`.
- Tentativa SQL com decisão aprovada e impacto forjado dentro da mesma matrícula foi rejeitada especificamente pelo novo guard de alcance; nenhum caso foi criado: `docs/validacao-alcance-negativo-435-2026-09-14.json`.
- Três cenários da cadeia A→B→C passaram, incluindo criação efetiva do caso após corrigir a avaliação oficial de A quando existe progressão aprovada em C: `docs/validacao-alcance-transitivo-435-2026-09-14.json`.
- TypeScript, ESLint direcionado e verificação de diff aprovados. Build completo aprovado com a nova rota e 62 páginas estáticas. Sem validação visual no navegador.
- Migração 197 aplicada somente no banco local descartável de testes. Comparação do banco com o schema sem diferenças.

## Ainda pendente

Resolução com proposta, aprovação independente e histórico; preenchimento auditado de casos históricos; demais frentes da SPEC integral. A consulta ainda apresenta o caso como pendente e não possui ação de conclusão. A busca de impacto continua conservadora por alocação, não uma prova de que toda nota do destino mudou. Não houve implantação em produção.
