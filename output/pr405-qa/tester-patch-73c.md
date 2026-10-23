# QA independente estática — PR #405 C2

Fonte exata: `73c7b52d6851c589c4dfbb83ab670b720f63208c`, pai `4af3286df9c5870b317f47553ec8bb3b96189831`. Parecer favorável ao delta documental, sem achado alto/médio. O patch altera somente quadro e `output/inbox-pr405-review-todos.md` (24 linhas), com `src/scripts/prisma/package/lock` idênticos ao pai (`2d547c`); checkout detached e rastreados limpos.

- Recalculei o inventário próprio em `output` contra a base #403 `68e95d8e`: no head anterior `16e3298d`, 20 arquivos/4.848 linhas = 12 MD/8 JSON; no pai `4af3286d`, 21 arquivos/4.863 linhas = 13 MD/8 JSON, sem remoções. A diferença é o MD `output/pr405-qa/revisao.md` de 15 linhas após a revisão inicial (`cf9e7e`). O novo relatório deste patch documenta esse inventário; não é ele próprio contado como parte do delta original.
- `output/inbox-319-global-final.md` e `output/inbox-319-pacote-review-tester.md` existem no checkout. O parecer histórico do pacote local registra 149 entradas: 140 PNG, 8 MD e manifesto, 12.106.367 bytes, SHA-256 `0972487e1b482aaf5058dff7482585b2404bd09751be7de9c90503f1a37b68c5`. Os JSON individuais de métricas/allowlists não compõem esse ZIP; conservá-los mantém fontes e limites das evidências. Não baixei, extraí nem reauditei o ZIP nesta rodada.
- O documento separa C2, de prioridade baixa e avaliado como retenção explícita da trilha, de C1/main/CI ainda pendente. Não reivindica novo browser, foto ou teste. `git diff --check` pai..HEAD retornou 0 (`0016bd`).

Não executei teste, DB, browser, Prisma, instalação, TSC, lint ou CI neste SHA de MD. Gates e imagens anteriores continuam atribuídos às fontes originais. A composição definitiva com main, predecessores e CI fica com o integrador; esta QA não a antecipa.
