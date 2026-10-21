# Incremento 374 — Cancelamento da recuperação agendada pela escola, 14/09/2026

## Entrega

A gestão prepara uma proposta de cancelamento para uma reserva com recuperação agendada. O alcance é apresentado antes da preparação: habilidades da reserva, realizações existentes, encontros, intervalos e avaliadores. A proposta guarda motivo, evidência da iniciativa da escola, autoria e memória imutável desse conjunto.

Outra pessoa da Gerência Pedagógica/Administração decide. Aprovar revalida o conjunto sob os locks do calendário e da matrícula. Uma nova realização ou alteração da agenda invalida a proposta anterior e exige nova preparação. Rejeitar conserva agenda e reserva, inclusive quando a proposta já está desatualizada.

A aprovação cria o cancelamento da reserva e muda seus encontros pendentes para `CANCELADO` atomicamente. Libera apenas as habilidades ainda não realizadas; realizações, notas e consumos anteriores permanecem. O escopo é a reserva identificada e suas habilidades pendentes, apresentado expressamente na tela. Não cria nova avaliação, nota, cobrança ou recebimento.

Propostas, decisões, cancelamento aplicado e agenda de origem ficam preservados. O servidor confere papéis ativos em cada ação, incluindo reenvios; o banco impede autoaprovação, origem não aprovada, alterações do histórico e aplicação duplicada. A concorrência de duas propostas para o mesmo conjunto permite somente uma liberação válida.

A nova página `/academico/recuperacoes/reservas/[reservaId]/cancelamento` apresenta situação atual, propostas paginadas, conjunto original e decisões. O plano oferece acesso a essa página. O formulário antigo de cancelamento direto deixa de aparecer quando há encontro previsto; seu bloqueio no servidor/banco permanece, exigindo o novo fluxo aprovado.

## Validação

80 integrações em dois arquivos aprovadas, sem testes omitidos nessa execução: avaliações e finalidade dos encontros. [Relatório](../validacao-cancelamento-agenda-recuperacao-374-2026-09-14.json).

Após acrescentar verificações explícitas de papel, revogação de usuário e apresentação do formulário, três cenários repetidos e aprovados; outros 73 testes não foram selecionados nessa repetição. [Relatório final](../validacao-cancelamento-agenda-final-374-2026-09-14.json).

Os novos cenários exercitam cancelamento parcial de uma reserva com habilidade já realizada, autoaprovação negada no servidor e SQL, reenvio sem duplicação, concorrência SQL com uma única decisão aplicada, invalidação por nova realização, rejeição preservando agenda, imutabilidade e acesso negado ao professor/usuário desativado. Conferem saldos antes/depois e ausência de cobrança/recebimento.

Build com TypeScript e 52 páginas estáticas aprovado, incluindo a nova rota dinâmica. Lint dos arquivos alterados aprovado. Migrations 168 e 169 aplicadas somente ao PostgreSQL descartável e Prisma regenerado. A 169 alinha o nome do índice truncado pelo PostgreSQL ao esperado pelo Prisma; a comparação final do schema está vazia. Não houve alteração de produção, envio externo ou homologação interativa.

## Limites

Esta entrega cobre iniciativa da escola e o conjunto pendente de uma reserva. Ainda faltam remarcação com nova disponibilidade, substituição do avaliador na agenda publicada, cancelamento/falta do aluno com antecedência e consumo conforme Q137, notificações e integração da agenda no portal do aluno. Agrupamento de habilidades num mesmo encontro, segunda chamada e autorizações específicas após pausa/encerramento continuam com suas pendências.

A regressão integral do projeto mais recente permanece a do incremento 371, anterior a estas mudanças. As evidências acima são direcionadas e não comprovam entrega integral nem todas as operações posteriores que possam afetar a agenda. O objetivo completo permanece em implementação.
