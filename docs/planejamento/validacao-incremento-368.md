# Incremento 368 — Atribuição docente nas oportunidades extras, 14/09/2026

## Divergência reproduzida e correção

O servidor aplicava `docenteAtual` às propostas e consultas de extras de recuperação. A função SQL `preservar_extra_recuperacao`, entretanto, conferia apenas papel ativo e existência de vínculo sem encerramento. Escrita direta aceitava professor com início futuro, professor diferente do titular atual ou vínculo em turma concluída.

Três testes reproduziram a divergência: a consulta, o reenvio e a nova proposta pelo servidor foram recusados, mas a inserção direta foi aceita. [Evidência anterior à correção](../validacao-extra-acesso-368-antes-2026-09-14.json). Esses resultados representam falhas esperadas de reprodução, não validação aprovada.

A migration 162, `20260914170000_extra_recuperacao_atribuicao`, substitui a proteção SQL para conferir titularidade, turma não concluída e início efetivo do vínculo sem encerramento. Preserva a autorização própria de Gestão Pedagógica/Administração, a independência da decisão, a imutabilidade, o saldo e a rejeição de propostas antigas. Os registros consultados ficam bloqueados durante a operação, seguindo a ordem institucional de calendário, matrícula, turma, alocação e usuário; o vínculo docente utilizado também recebe bloqueio de leitura.

A migration foi aplicada somente ao PostgreSQL descartável. Não altera documentos ou propostas anteriores nem remove dados. O schema Prisma não mudou; a comparação do banco com o schema está vazia. TypeScript e lint direcionado aprovados. Após a correção, os 65 testes da suíte de avaliações passaram, incluindo os três casos de regressão: [relatório](../validacao-extra-acesso-368-2026-09-14.json). Não foram repetidos unitários, build ou regressão integral de todas as integrações; não houve alteração de interface nesta rodada.

## Continuidade de Q137

A inspeção também confirmou que `ReservaTentativaRecuperacao` reserva oportunidades, sem início/fim agendados. Não é possível calcular cancelamento tardio a partir de `criadaEm`: é o horário da avaliação, e não o momento da reserva da cota, que deve definir a antecedência.

A integração precisa associar as habilidades a um encontro autorizado, conservar início/fim/fuso e professor, conferir calendário/indisponibilidades/conflitos/reservas comerciais e preservar versões de remarcações. Só então a ocorrência de falta/cancelamento do aluno poderá consumir ou liberar as habilidades atingidas pelo encontro, sem lançar nota zero ou realização. Particular contratada, reposição de aula e recuperação não podem compartilhar cobrança ou cota implicitamente. O cancelamento pela escola já existente permanece separado.

Não houve implementação das ocorrências do aluno neste incremento. Segunda chamada, fechamento versionado, progressão e homologação operacional continuam pendentes. Uma correção de autorização não comprova conclusão integral de Q137, Q150 ou do projeto.
