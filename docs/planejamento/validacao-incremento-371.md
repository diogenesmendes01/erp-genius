# Incremento 371 — Finalidade dos encontros, 14/09/2026

## Alteração

`EncontroAgenda.finalidade` distingue `AULA` e `RECUPERACAO`. A migration 164 (`20260914190000_finalidade_encontro`) conserva como `AULA` os encontros existentes, correspondentes aos fluxos de turma/particular implementados. A finalidade é imutável; uma recuperação exige matrícula identificada e não é encontro coletivo da turma.

A publicação de recuperação permanece bloqueada no banco enquanto seu fluxo específico de aprovação não estiver implementado. Não existe nova ação para contornar essa restrição; rascunhos de recuperação usados nos testes não confirmam horário. A futura publicação deverá referenciar a proposta e sua decisão independente na mesma transação, atualizando essa proteção com evidência de aprovação, e não simplesmente removendo-a.

Consultas e ações de diário/chamada, conclusão de aula, ocorrência de particular, seleção de horas compradas, fila financeira, apuração mensal por hora, cancelamento/remarcação de particular e substituição de professor em aula conferem a finalidade. A lista de encontros destinada ao diário exibe somente aulas. A frequência do vínculo também seleciona aulas explicitamente.

Proteções SQL recusam uso de recuperação na criação/alteração de diário, exceção de gravação, reserva de horas compradas, ocorrência particular, proposta de cancelamento/remarcação de particular e item de substituição docente. As referências seguintes de consumo e cobrança dependem desses registros de origem, que não podem pertencer a recuperação. Uma recuperação não recebe presença de aula ou ocorrência cobrável por esses caminhos.

## Evidências e limites

Regressão completa de integração aprovada: **738 testes em 55 arquivos**, sem falhas ou pendências, executados sequencialmente no banco descartável em aproximadamente 643 segundos. [Relatório integral](../validacao-finalidade-integracao-371-2026-09-14.json). A nova suíte de finalidade participou dessa execução já com a fixture corrigida. Esta rodada substitui a regressão completa histórica do incremento 354 como evidência mais recente, sem transformar funcionalidades pendentes em entregues.

Três testes novos verificam finalidade padrão de aulas, impossibilidade de mudar a finalidade histórica, bloqueio da publicação de recuperação, ações e escritas diretas de diário/ocorrência/cancelamento, fila financeira sem recuperação e rejeição de cursor de recuperação. Conferem ausência de diário, cobrança e consumo resultantes.

839 unitários em 91 arquivos aprovados: [relatório](../validacao-finalidade-unitarios-371-2026-09-14.json). Lint dos arquivos alterados, comparação do schema vazia e build com TypeScript/52 páginas estáticas aprovados. O primeiro build identificou `inicio`/`fim` ausentes na fixture da ocorrência direta; os campos foram adicionados e o build repetido passou, sem afrouxar proteções de produção.

Migration aplicada apenas ao PostgreSQL descartável; Prisma regenerado. Sem alteração de produção, envio externo ou homologação interativa.

## Trabalho ainda necessário antes de publicar

Implementar decisão independente com publicação atômica e origem verificável do encontro; atualizar acompanhamento de recuperações, designação/remarcação/cancelamento de avaliadores e tentativas; tratar as avaliações separadamente nos impactos de mudança global de calendário e de encerramento contratual. Em particular, `replanejamento-tx.ts` ainda trata encontros sem turma como particulares e `encerramento-impactos-academicos.ts` ainda reúne encontros vinculados à matrícula em `encontrosParticulares`. Não liberar a publicação de recuperações antes de ajustar esses consumidores e suas memórias de cálculo.

Os controles comuns de conflito/indisponibilidade devem continuar considerando todas as finalidades publicadas. A segregação da finalidade não implementa segunda chamada, fechamento acadêmico, progressão ou o restante de Q137/Q150. O objetivo completo permanece em implementação.
