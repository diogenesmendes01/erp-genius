# Integração 382 — Consultas de reposição

Cinco testes de integração passaram em `src/server/diario/reposicao-permissoes.int.test.ts`. Relatório: `docs/validacao-consulta-reposicoes-382-2026-09-14.json`.

O novo teste de consulta confere matrícula, isolamento de informações, independência do aprovador e revogação de acesso. O teste de histórico verifica que uma correção pendente não altera a conclusão e que, depois de aprovada, a correção pode anular a conclusão/data sem apagar a fonte original. A consulta escolhe primeiro a conclusão vigente, depois sua correção aprovada, sem misturar as sequências de versão ou restaurar campos explicitamente nulos.

O teste de ausência de designação foi reforçado para preencher a autoria obrigatória e exigir a mensagem da regra de designação. Assim, sua aprovação não depende de uma falha incidental por campo ausente.

A interface passou a usar limites/cursor, instantes UTC e matrícula real na fila. A associação arbitrária de qualquer encontro da matrícula a qualquer pedido foi retirada enquanto o vínculo de agenda próprio está em implementação. O agendamento por pedido e a identidade/autenticação do aluno continuam em frentes independentes; não estão comprovados por estes testes.

Não houve nova migration nesta rodada. Rascunhos de migrations devem permanecer fora de `prisma/migrations` até revisão, pois o global setup aplica automaticamente todas as migrations desse diretório. Um diretório vazio de rascunho foi removido atomicamente, sem apagar arquivos, para retomar a execução.

A regressão de 113 testes e build da rodada 381 permanece a última evidência ampliada anterior a estas consultas. Objetivo integral e homologação continuam pendentes.
