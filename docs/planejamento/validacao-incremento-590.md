# Incremento 590 — Decisões de agenda concorrentes com pausa contratual

Data: 16/09/2026. Objetivo integral em andamento.

## Achado confirmado

Os fluxos do servidor usam `bloquearLancamento`: calendário, lead, matrícula, turma e alocação antes da conferência acadêmica. Pausa e retomada bloqueiam lead e matrícula. As decisões SQL diretas de agenda inicial, remarcação e substituição não obtinham todos esses bloqueios antes de ler a situação contratual; uma pausa poderia confirmar depois da leitura e antes dos efeitos.

A ordem também precisa considerar os gatilhos anteriores à aplicação. Bloquear uma proposta primeiro e aguardar o contexto depois pode inverter a ordem usada pelo servidor. Uma leitura inicial sem bloqueio pode identificar a origem; o contexto deve ser conferido novamente depois da espera.

## Requisito

A decisão deve aguardar a alteração contratual concorrente, revalidar a situação confirmada e aplicar somente se continuar válida. Se a pausa reverter, a decisão ainda válida pode prosseguir. Preservar os efeitos atômicos, aprovações independentes, documentos históricos e idempotência.

## Implementação e revisão

A migration 131 adiciona um helper de bloqueio/revalidação e três triggers `00_bloquear_decisao_*`, executados antes dos guards existentes, inclusive o guard de calendário prefixado `a_` da remarcação. Mantém reserva quando existente, calendário, lead, matrícula, turma e alocação antes de bloquear fonte e proposta. Revalida o vínculo e o lead após a espera. Os aplicadores e as guardas anteriores permanecem.

A revisão também identificou que rejeição de proposta obsoleta não deve depender de contexto válido para aplicação. A migration 132 restringe a conferência contratual bloqueante às aprovações; rejeições preservam reserva/calendário/proposta e as regras anteriores. Nenhuma migration aplicada foi reescrita.

## Evidência

- Cinco testes direcionados aprovados após 131: `docs/validacao-integrada-concorrencia-590-2026-09-16.json`. Os três caminhos aguardam pausa concorrente, confirmam espera real em `pg_stat_activity` com `pg_blocking_pids` e recusam depois do commit. Um controle permite aprovação após rollback. Outro mantém o calendário bloqueado e confirma que a decisão direta não captura antes a proposta, usando `FOR UPDATE NOWAIT` pela conexão que simula a ordem do servidor.
- Em substituição, a pausa confirmada invalida o snapshot e exige nova proposta antes de chegar ao aplicador; a mensagem esperada do teste foi ajustada para essa recusa específica.
- Rodada conjunta após 131: **98 de 101 testes aprovados**. Os 93 casos anteriores e cinco novos de concorrência passaram; os três novos de rejeição de contexto obsoleto reproduziram a regressão posteriormente corrigida. Evidência preservada: `docs/validacao-integrada-final-590-2026-09-16.json`.
- Após aplicar 132, **oito testes específicos aprovados**, sem falhas ou ignorados: `docs/validacao-integrada-concorrencia-final-590-2026-09-16.json`. Incluem novamente os cinco de concorrência e os três de contexto obsoleto: aprovação proibida, rejeição registrada sem aplicação nem cobranças. Não houve nova rodada conjunta de 101 depois de 132; não somar as execuções como casos distintos.
- Lint e tipos finais aprovados: `docs/validacao-lint-590-2026-09-16.log` e `docs/validacao-tipos-590-2026-09-16.log`. Código de produção alterado somente nas migrations; o build do incremento anterior permanece evidência histórica, não nova execução desta rodada.

As migrations 131 e 132 foram aplicadas apenas em `localhost:54329/erp_genius_test`. A revisão anterior à aplicação corrigiu o prefixo dos triggers para garantir precedência sobre `a_`, revalidou `leadId` depois da espera e retirou cópias redundantes dos aplicadores. O teste final usa as mensagens específicas das guardas; a substituição recusada por snapshot alterado não é confundida com rejeição pelo cálculo temporal.

## Limites

Não há homologação interativa, produção, importação de dados reais ou envios externos nesta rodada. Q164 e os demais requisitos pendentes do objetivo integral permanecem abertos.
