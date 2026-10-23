# QA independente — composição final PR #398

Fonte final exata: `70ec3dd442f912a50c599325634e0a18d3ad55cb`. Patch funcional já revisado: `d5f78f9393ada93bc3e9a7d137aea207f5f60378` (QA anterior: 81 testes UTC e 81 America/Sao_Paulo). Merge funcional `d441c631c55faab0035c6c32a57938a21ae4dade` incorporou a base #397 `0473b82b0a5d3cb4ada2dfa3d4405ba5d16da029`; commits seguintes `794191c5`, `696e6270` e este head fecham documentos/ancestralidade. Parecer favorável à extensão estática, sem achado alto/médio.

## Identidade da fonte

- `src/components/conversa` inteiro, incluindo `itens-thread`, `BalaoMensagem`, `VirtualList`, `EventoSistema`, `SeparadorDia`, `agora-thread` e testes, é byte idêntico ao patch `d5f78f93`; `ConversaAberta.tsx` e seu teste também são idênticos (`7b910e`). Os OIDs específicos de `itens-thread.ts` e `BalaoMensagem.tsx` permanecem `358b700e...` e `593f8048...` (`b9d5f7`). A memória do dia não é apagada por data inválida e o fallback de autor vazio/whitespace continuam exatamente como na QA dirigida anterior. Nenhuma regressão de montagem/VirtualList da #314 foi introduzida neste delta.
- De `d441c631` para o head final, `src`, código dos scripts, Prisma e package/lock não mudaram. O único caminho sob scripts é `scripts/visual/README.md`: `794191c5` removeu uma seção **duplicada** “Telefones em evidências”; havia duas em `d441`, resta uma com a orientação de anonimização (`4c16c3`, `d4e918`). `696e6270` tem árvore inteira igual a `794191c5`; `70ec3dd4` altera apenas dois MD (quadro e relatório da composição).
- `b98da363` (squash main #397) é ancestral deste head (`9e91f4`). Os caminhos do kit QA #280, planos/protótipo #297, package/lock, guardas de botões/identificação e arquivos de configuração selecionados permanecem iguais à main (`dac02a`, `7b910e`); `docs/planejamento/inbox-decisoes-produto.md` e protótipo estão presentes. Não reatribuo sua proveniência nem refaço QA histórica.
- `git diff --check` de `d441` ao final, incluindo docs/relatório/README, retornou 0 (`b9d5f7`). O parecer antigo de `d5` e seus testes pertencem à fonte funcional; gates 13/183 UTC/SP, TSC/lint e CI finais relatados por outro integrador não são minhas execuções.

## Limites

Esta é comparação estática de objetos/diffs; não executei novos testes, banco, browser, Prisma ou instalação. A composição final continua dependente de CI/retarget e do merge coordenado. Não chamo capturas ou manifesto histórico de nova prova visual desta fonte.
