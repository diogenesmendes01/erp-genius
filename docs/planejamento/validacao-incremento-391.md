# Incremento 391 — regressão do vínculo de reposição

Data: 14/09/2026.

As fixtures de frequência e permissão passaram a criar autorização excepcional independente, pedido, agenda, encontro e diário vinculados. Não removem guardas para simular realização. O helper compartilhado é `src/test/reposicao-agenda.ts`.

A execução das três suítes de reposição teve dez testes aprovados e quatro falhas: `../validacao-reposicoes-391-2026-09-14.json`. O agendamento regular de benefício aprovado e o bloqueio de pedidos duplicados passaram. Duas falhas estão na conclusão de particular excepcional; uma está na entrada da exceção de calendário; a quarta foi apenas a redação específica da mensagem esperada para docente sem designação, atualizada para a mensagem vigente sem retirar a exigência de erro.

As três falhas funcionais restantes estão em investigação. Não houve nova regressão depois da correção da mensagem; não declarar onze aprovações por inferência. Identidade e outbox possuem evidências separadas do incremento 390. A meta completa continua em implementação.
