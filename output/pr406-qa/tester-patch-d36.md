# QA independente — patch PR #406

Fonte exata: `d36fe200e0faa4483ed64a5833c9500fa44a808d`, pai `9ed8a88ac77d69ea71c1908f0d7ed742ad8c83e6`. Patch preparado para cherry-pick futuro; este parecer não aprova a ancestralidade E2 nem substitui a CI do head final. Sem achado alto/médio no delta.

## Revisão

- O diff contém somente a exclusão de um caso puro de `src/server/inbox/eventos-sse.int.test.ts` (13 linhas), mais quadro e relatório. Produtor `eventos-sse.ts` e teste unitário `eventos-sse.test.ts` têm objetos Git idênticos à publicação `1bb721b7` e ao pai: respectivamente `aae6a83e...` e `2f26a0d1...` (`2857c5`). O arquivo INT antes da edição também tinha o mesmo objeto `fec81a5c...` da publicação.
- A prova removida comparava framing de quatro linhas, campos públicos que contêm `u9` e ausência estrutural de `paraUsuarioId`. O teste unitário existente usa o formatador real importado de `eventos-sse.ts` e mantém exatamente essas asserções; não é um clone da função. O arquivo INT conserva o caso básico de formato e os cenários dependentes de banco de escopo, destinatário, revogação/resync e grupos.
- A redução de 11 para 10 testes de integração no arquivo é intencional e não perde a prova de privacidade do quadro. `git diff --check` do patch retornou 0 (`2857c5`). C2/tabela visual e C4/inventário são documentação e não foram refeitos por esta revisão.

## Execução própria

Node 22.23.2, Vitest local, `src/server/inbox/eventos-sse.test.ts` inteiro, `--maxWorkers=2`, sem filtro de nome ou skips: **1 arquivo / 8 testes aprovados, exit 0**, execução `02325f`.

## Limites

Não executei banco, browser, Prisma, instalação, integração, typecheck, lint nem suíte global. Os 10 casos INT e demais gates descritos pelo ROOT pertencem à execução dele. C1/CI contra main, aplicação do patch no futuro head #406 e retarget seguem pendentes; este parecer se limita à identidade e à cobertura do delta exato.
