# Incremento 390 — integridade de pedidos e envio de identidade

Data: 14/09/2026.

Cinco testes de identidade passaram, incluindo persistência do token antes do callback externo, estado INCERTO e bloqueio de reenvio automático. O relatório conjunto `../validacao-agenda-portal-390-2026-09-14.json` contém seis aprovações e duas falhas: uma de agendamento por leitura de retorno SQL void, outra da fixture que tentou alterar calendário imutável. Ambas foram encaminhadas para correção, preservando as guardas.

Foi aplicada somente ao banco de teste a migration `20260915006000_pedido_reposicao_unico`. Ela preserva a validação existente de origem/contrato/papel e acrescenta proteção contra pedido simultâneo para a mesma ausência. Pedido rejeitado ou tentativa particular consumida por falta, sem conclusão, permite nova solicitação; NULL não é tratado como autorização.

O teste direcionado de solicitação foi ampliado e passou: recusa de inserção SQL duplicada, recusa pela ação, rejeição independente, nova solicitação e histórico preservado. Sete testes do arquivo ficaram fora desse filtro. Fixtures de casos independentes passaram a usar aulas originais distintas, sem depender de duplicatas indevidas. A fixture de particular válida e a regressão integral continuam em adaptação.

A numeração de planejamento reserva 179 para segunda chamada ainda em rascunho; a contagem física do diretório agora é de 179 migrations. Não há alteração em produção nem conclusão da SPEC.
