# QA independente documental PR #297 — 80d294ce87fcb74593d8b03ed6df0153de932a44

Parecer favorável ao candidato documental no commit exato. Revisão read-only por objetos Git, sem checkout ou alteração do worktree TESTER. Não identifiquei achado alto ou médio.

## Escopo e identidade

- Candidato é merge do planejamento `8f42a15e6624f1f4967f79e7ed767f1bea87b7d3` com main `2f512985d182cd8c3d074bb3963ddbfa7da9fc98`. Contra main, o delta tem 15 arquivos: índice + cinco planos Markdown + cinco JSON (11), decisões de produto, HTML do protótipo, quadro e relatório QA. Os 11 arquivos de plano são adicionados aqui; não os classifico como implementação.
- `src`, `scripts`, `prisma`, `package.json`, `package-lock.json`, `eslint.config.mjs`, `.github`, `e2e` e `playwright.config.ts` são byteidênticos à main. Não há dependência B2 nem mudança de produto nesta PR.
- Os 22 PNG sob o protótipo são byteidênticos aos da main, totalizando 5.383.834 bytes; nenhum PNG foi adicionado, removido ou alterado. São referências históricas, sem nova sanitização ou nova captura atribuída a esta revisão. Checagem Git chunk `335003`, exit 0.

## Conteúdo verificado

- Cinco `*.issues.json` parseiam e somam 8+15+21+18+19 = **81** itens com 81 títulos únicos; os três itens E1.8, E1.10 e E1.11 têm `decisao-pendente` no JSON e no plano Markdown. Chunk `80e4c4`, exit 0.
- O diff do HTML frente ao planejamento original troca exatamente sete literais de e-mail do objeto de demonstração. O candidato tem sete e-mails literais, todos em `example.com`, nenhum com outro domínio. Isso comprova apenas o objeto literal HTML: não auditei proveniência de cliente, banco ou serviço. Chunks `2b7d86` e `c08d23`, exit 0.
- O índice referencia D1 por `capacidadesAria` / `decidirHistorico` no caminho completo `src/server/aria/permissoes-tela.ts`; o símbolo existe na fonte. Os dois links relativos novos do índice resolvem para `docs/planejamento/inbox-decisoes-produto.md` e `docs/planejamento/quadro-entregas.md` existentes no candidato. O detector genérico de Markdown encontrou duas aparentes referências `PASSOS_APP[estado](page, ids)` / `PASSOS_PROTOTIPO[estado](page)` dentro de código em backticks no plano 02; não são links Markdown nem arquivos ausentes. Chunks `2b7d86`, `c841cb`, `f23c1f`, exit 0.
- Decisões D1–D6, D9–D13, D20 e D22 constam no registro. A redação inclui documento LATAM, presença após 10 minutos e insights de IA sob demanda; o índice declara que respostas posteriores prevalecem sobre padrões históricos, sem presumir entrega. Reservas #322 e #337 aparecem no índice e no quadro, com exigência de coordenação do integrador e sem tratar faixas como unicidade automática. Chunks `371efa`, `2b7d86`, `c08d23`, exit 0.
- `git diff --check` no delta documental contra main: exit 0, chunk `c841cb`.

## Limites

Não executei TSC, lint, suite global, banco, browser, instalação ou CI; o código/configuração é idêntico à main e a CI do head da PR é gate separado. Confirmei apenas a redação/versionamento das decisões registradas, não a origem externa de aprovação do cliente. Os PNG são históricos e não constituem nova evidência visual produzida por esta QA.
