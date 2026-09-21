# Incremento 392 — períodos de benefício sem deslocamento

Data: 14/09/2026.

O cálculo mensal agora deriva início e fim da referência original do ciclo. Antes, um ciclo ancorado no dia 31 poderia produzir fevereiro 28 → março 28; o correto é fevereiro 28 → março 31. O mesmo cuidado preserva referência bissexta em ciclos anuais. Datas inexistentes e durações inválidas são recusadas.

Nove testes unitários passaram em `reposicao-periodo.test.ts`, incluindo fronteiras contíguas, meses civis, dias corridos e períodos de vários meses. A migration `20260915008000_periodo_reposicao_ancora` foi aplicada somente ao banco de teste e atualiza a função SQL correspondente. Um teste de integração comparou aplicação e SQL em cinco datas e passou.

A revisão também identificou ajustes necessários na primeira vigência do benefício e nas mudanças entre períodos diferentes; essa parte segue com o agente responsável e não é comprovada por estes testes de cálculo. As falhas anteriores de conclusão particular/exceção também não devem ser consideradas resolvidas por esta validação.

O build iniciado neste incremento falhou: o painel de acesso do aluno importava diretamente o módulo interno de identidade em componente cliente. A correção deve separar ações administrativas públicas dos serviços internos de autenticação e despacho; adicionar `use server` ao módulo inteiro exporia funções que não devem ser ações públicas. O erro foi encaminhado ao agente do portal, junto da correção do uso de `event.currentTarget` depois de uma espera assíncrona. Build ainda não validado.
