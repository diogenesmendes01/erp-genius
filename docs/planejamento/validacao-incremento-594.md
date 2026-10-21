# Incremento 594 — Efetivação de desistência sem avanço formal

Data: 16/09/2026. Objetivo integral ativo. A rodada anterior (593) foi progresso verificado; esta implementa a execução do ramo simples de Q121, preservando o escopo dos demais casos.

## Implementação

[Regra detalhada](../specs/desistencia-preparacao.md). Secretaria/Administração efetiva o último pedido ainda conferido quando não existem cobranças, créditos, documentos, processos de assinatura, alocações, aceite ou ativação. Reserva utilizada impede este ramo. A tela pede conferência final, inclusive dos canais externos, e conserva motivo e executor.

Aplicação única por matrícula/pedido muda o estado para CANCELADA e libera ATIVA/MANTIDA_PENDENCIA das reservas coletivas e particulares na mesma transação. Preserva os demais estados de reserva e o histórico, sem alterar aluno ou outros contratos. Reenvio idêntico não duplica aplicação. SQL verifica papel ativo, fontes atuais, versão do pedido, reservas e condição preparatória; preserva a aplicação contra alteração/exclusão e protege contra reativação ou novo avanço formal.

Documento posterior pode ser anexado como evidência tardia; a tela sinaliza conferência, sem reverter a desistência. Documento criado na própria transação de efetivação invalida a execução simples. A presença de documento ou valor anterior exige o fluxo financeiro/documental ainda pendente.

## Correções durante a validação

- A pré-verificação da migration 135 usou transação com ROLLBACK no banco de testes. Identificou sintaxe de CASE no IF PL/pgSQL; corrigida antes da aplicação. A migration 135 depois aplicada permanece preservada.
- Primeira integração: 12 de 16 cenários passaram. Três falharam por fixture sem docente/agenda publicada, corrigida com fontes reais. A quarta expôs que Prisma pode resolver o callback mesmo quando uma constraint deferred rejeita o COMMIT. A action agora força `SET CONSTRAINTS ALL IMMEDIATE` depois dos efeitos/evento e antes de confirmar sucesso.
- Uma conferência direta com cliente PostgreSQL confirmou que o COMMIT de aplicação mais documento na mesma transação é recusado com “Efetivação simples não permite fonte concorrente no commit”, e a matrícula permanece AGUARDANDO. O teste automatizado também verifica a constraint e o rollback explicitamente dentro do callback.
- Revisão adicional identificou corrida na verificação de nova reserva antes da espera pelo calendário. A migration 136 ordena bloqueio por statement antes das triggers de linha e relê a matrícula antes de permitir reserva vigente. Não modificar migration aplicada para inserir esta correção.

## Evidências da rodada

- Migrações 135 e 136 aplicadas somente em `localhost:54329/erp_genius_test`; logs `docs/validacao-migration-594-2026-09-16.log` e `docs/validacao-migration-concorrencia-594-2026-09-16.log`. Ambas preservadas após aplicação.
- `docs/validacao-integrada-inicial-594-2026-09-16.json` preserva a rodada inicial com quatro falhas; não representa aprovação final.
- Após corrigir a fixture e observar a constraint dentro da transação: **125 integrações aprovadas**, sendo 10 de efetivação, 7 de pedido, 67 de reserva, 20 de política financeira e 21 de substituição contratual. Evidência: `docs/validacao-integrada-final-594-2026-09-16.json`.
- Após aplicar a migração 136: **85 integrações aprovadas**, sendo 11 de efetivação, 7 de pedido e 67 de reserva. A nova concorrência insere a aplicação em TX1, prova a espera de TX2 por bloqueio real consultando `pg_stat_activity` e `pg_blocking_pids`, libera TX1 e confere a rejeição da nova reserva direta. A PrismaPromise de TX2 é consumida explicitamente para iniciar a operação antes da observação. Evidência: `docs/validacao-integrada-concorrencia-594-2026-09-16.json`.
- **7 unitários aprovados**: 6 de renderização (incluindo execução simples, pendência complexa e histórico aplicado) e 1 da conferência de crédito isolado. Evidência: `docs/validacao-unitaria-594-2026-09-16.json`.
- Tipos, lint e build aprovados: `docs/validacao-tipos-final-594-2026-09-16.log`, `docs/validacao-lint-594-2026-09-16.log`, `docs/validacao-build-594-2026-09-16.log`.

Não somar reexecuções como cenários diferentes. O teste de concorrência entre duas transações desta rodada cobre reserva coletiva; o ramo particular foi validado com criação real da reserva e preservação dos horários, além da regressão compartilhada. Esses resultados não comprovam todas as combinações concorrentes possíveis ou o fluxo complexo ainda ausente.

## Limites e próximos requisitos

Este ramo não cumpre Q121 inteiro. Casos com acerto financeiro, documentos/assinatura, decisão administrativa independente ou pendências externas ainda precisam da sua própria proposta, conferência, decisão e efetivação. Não foi realizado teste interativo, produção ou envio externo. A condição financeira/documental restrita delimita o ramo implementado; não elimina esses casos do objetivo.
