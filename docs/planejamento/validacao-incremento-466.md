# Incremento 466 — designação para regularização de aula (Q24)

Data: 15/09/2026. Meta integral consultada e ativa; continuidade retomada.

## Implementação

Modelos e migration `20260915044000_designacao_regularizacao_aula` registram designação e revogação imutáveis, com motivo, responsáveis e datas. Uma aula prevista cujo horário terminou pode ter uma designação vigente. Gestão Pedagógica/Administração ativa designa professor ou integrante ativo da gestão. A revogação preserva a atribuição anterior.

As ações verificam permissões atuais, serializam pelo calendário e registram eventos. Repetir a mesma operação não duplica designação ou revogação. Professor original, encontro, turma e diário não são alterados. A validação do motivo foi alinhada entre aplicação e banco.

## Validação

Três testes de integração iniciais aprovados em `docs/validacao-designacao-q24-466-2026-09-15.json`. Cobrem concorrência idempotente, revogação, preservação do encontro/professor e recusa de papel indevido, responsável inativo e aula futura. TypeScript e lint direcionado aprovados. A migration foi aplicada somente ao banco descartável de testes.

## Limites e próxima integração

Regressão final: 37 testes aprovados (34 de correção de aula e 3 de designação) em `docs/validacao-designacao-regressao-q24-466-2026-09-15.json`, incluindo inserção SQL com designador indevido e duplicação de designação vigente recusadas.

Esta etapa registra a atribuição; ainda não libera ao designado o lançamento nem a leitura da chamada. A revisão Terra identificou os pontos em `acoes.ts`, `chamada-encontro.ts` e `particular.ts`: reconhecer a designação vigente, preservar o professor original no diário e registrar o autor efetivo da regularização. Os guards que preservam aulas ministradas devem continuar vigentes. Não houve deploy ou alteração de produção. A SPEC integral permanece em implementação.
