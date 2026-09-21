# Integração das frentes Terra — 14/09/2026

## Substituição de professor na recuperação

Backend e interface agora oferecem decisão independente e aplicação conjunta da designação e do professor do encontro. A proposta revisada tem hash conferido, versão e origem preservadas. Rejeição registra histórico. O servidor recusa pendências, autoaprovação e propostas superadas; a consulta não oferece aprovação de propostas com impedimentos conhecidos.

Quatro testes focados passaram no banco descartável: propostas versionadas e acesso; fontes alteradas por ausência/inativação; cancelamento posterior; cadeia A→B→C→A. O último verifica que reenvio antigo não restaura professor anterior, tentativa direta de reutilizar a autorização antiga falha e cancelamento preparado antes da troca perde validade. Intervalos, matrícula, origem e ausência de efeitos financeiros permanecem conferidos.

A migração `20260914233000_decisao_substituicao_recuperacao` foi corrigida após erro de sintaxe em sua primeira aplicação. Verificou-se ausência da tabela/coluna novas, registrou-se rollback da tentativa e reaplicou-se com sucesso, exclusivamente no banco de teste. O schema correspondente apresentou diff vazio.

Uma revisão adicional identificou que inserções diretas de decisão precisavam verificar mudanças nas fontes acadêmicas. A migração `20260914235000_fontes_substituicao_recuperacao` foi aplicada depois da rodada focada; seus efeitos ainda exigem nova execução. Não atribuir a ela a evidência anterior.

## Resultado integrado e pendências

A execução completa de `lancamentos.int.test.ts` terminou com **81 aprovados e 2 falhas**, de 83 testes. Relatório: `docs/validacao-substituicao-aplicada-378-2026-09-14.json`. As duas falhas pertencem à frequência, cujo carregador da frente paralela passou a exigir fontes de reposição ainda sem migração aplicada. A execução não está aprovada como um todo.

O build compilou e falhou na checagem de tipos de um novo teste de frequência. O agente corrigiu o estreitamento de `matriculaId`; ainda falta repetir o build integrado após estabilizar a frente.

Atualização: a repetição do build passou, incluindo TypeScript e geração de 52 páginas estáticas. Isso resolve o erro de tipo acima, mas não substitui a repetição das integrações após a migração de reposições. Foi acrescentado um teste de inserção direta de decisão após correção acadêmica; sua execução ainda está pendente.

Os modelos iniciais de reposição individual e suas relações inversas foram incorporados ao schema, que passou em `prisma validate`. Sua migração, fontes de entrega/realização, controles e interface continuam em elaboração. Não presumir que uma particular contratada ou recuperação de nota regularize frequência.

O orquestrador mantém migrations, geração de cliente e testes de integração sequenciais. Os agentes mantêm implementações separadas. Produção, homologação interativa e a totalidade da SPEC não estão concluídas.
