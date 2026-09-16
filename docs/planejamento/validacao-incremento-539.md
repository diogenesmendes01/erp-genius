# Incremento 539 — situação contratual na realização de recuperação

A proteção do banco agora reconstrói a situação da matrícula na data da realização usando ativação, pausas e retomadas aplicadas e encerramento efetivado. Sem autorização específica, exige situação ativa; com autorização, exige comprovação de pausa ou encerramento. Histórico insuficiente exige conferência. Permanecem as validações de atribuição, reserva, prazo, plano e alcance da autorização.

A migration `20260915091000_situacao_contratual_recuperacao` adquire o bloqueio institucional e o da matrícula antes de reconstruir o histórico. A revisão independente Terra identificou a necessidade desse bloqueio; a correção precedeu a primeira aplicação no banco de testes.

O novo cenário integrado efetiva um encerramento pelo fluxo financeiro com aprovação independente, verifica a alocação encerrada, recusa realização sem autorização e permite somente a recuperação especificamente autorizada. Ao terminar, a matrícula continua encerrada e a alocação permanece inativa. Os testes de pausa efetiva e de histórico insuficiente também exercitam inserções diretas no banco.

Validação direcionada: três testes aprovados, zero falhas, 89 não selecionados em `docs/validacao-temporal-recuperacao-539-2026-09-15.json`. A suíte completa de lançamentos acadêmicos passou com 92 testes, zero falhas e zero ignorados em `docs/validacao-academica-539-2026-09-15.json`. ESLint e TypeScript (`--noEmit --incremental false`) aprovados.

Limites: Q151 continua parcialmente entregue. Pendências sem reserva e a coerência de todas as projeções de ações ainda precisam de implementação/conferência; não houve ensaio interativo nem operação de produção. O histórico SQL exige datas aceitas pelo PostgreSQL; datas civis extremas que não possam ser reconstruídas ficam em conferência.
