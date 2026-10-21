# Incremento 440 — correções de reposições e preservação do histórico

Data: 14/09/2026. Meta integral ativa.

## Implementação

A consulta de Q54 exige Gestão Pedagógica/Administração ou professor atualmente designado, sem expor cadastro financeiro, contatos ou outros contratos. A tela oferece fontes da própria reposição, motivo, evidência e decisão independente. A proposta não modifica a frequência antes da aprovação.

A aprovação revalida também a autorização do preparador. A leitura da frequência preserva validações anteriores quando o professor é desativado e escolhe a conclusão mais recente antes de aplicar filtros, evitando recorrer a versões anteriores retiradas. Permissões atuais continuam obrigatórias para novas ações.

A migração 201 impede substituir uma conclusão efetiva por outra conclusão direta, contornando Q54. Uma nova avaliação só pode ser concluída depois da retirada aprovada da anterior. O servidor e o banco conferem sequência, fonte, autoria e atribuição docente; a operação preserva os registros anteriores.

## Evidências

38 testes de integração em seis arquivos aprovados em `docs/validacao-correcao-reposicao-440-2026-09-14.json`: correção/retirada e frequência, revogação, independência com acúmulo de papéis, hash divergente, bloqueio de nova conclusão direta e reavaliação após retirada, isolamento da consulta, histórico, portal e operações de entrega. Uma asserção antiga de mensagem foi ajustada à mensagem do guard compartilhado, sem alterar a expectativa de rejeição.

Migração aplicada exclusivamente ao banco descartável local. Build completo aprovado, com a nova rota de correções, TypeScript e lint direcionado aprovados. Após a revisão da consulta e da interface, os oito testes de correção foram repetidos e passaram em `docs/validacao-consulta-correcao-440-2026-09-14.json`, incluindo recusa explícita de Financeiro. Os testes de servidor e o build não comprovam validação interativa.

## Pendências

Casos persistidos de revisão de progressão afetada por Q54 e a correção independente de aulas ministradas de Q23 continuam pendentes. A consulta apresenta até 20 conclusões anteriores; a navegação completa pelas correções dessas conclusões antigas ainda precisa ser ampliada. Datas legadas de criação de conclusões não são usadas para afirmar horários UTC: a interface usa os instantes de realização/validação da fonte. Sem implantação em produção.
