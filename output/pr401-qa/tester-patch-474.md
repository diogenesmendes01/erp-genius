# QA independente estática — PR #401

Fonte exata: `47445bc5758a4965df99361c807d7ac421c3b5b5`, pai `0fcaf4595649fcee53027757da3f462e3205170d`. Parecer favorável à extensão documental, sem achado alto/médio. Patch restrito a SPEC, quadro e relatório (três MD); `src/scripts/prisma/package/lock/.github` idênticos ao pai (`c838de`, `eb8002`), rastreados limpos.

- C2/C3: `CabecalhoConversa.tsx` mantém Buscar `disabled`/“Em breve” e Voltar com `min-[960px]:hidden`; `MenuConversa.tsx` também desabilita Buscar. O corte 700 px controla apresentação, e o painel automático usa 1400 px. A SPEC distingue corretamente o contrato preparado da ativação futura na #316/PR402 (`eb8002`).
- C4: `useAcoesAtendimento` está em `AcoesAtendimento.tsx`. Seu helper `rodar` chama `aposSucesso` apenas para `d?.tipo === "ok"`; `marcarNaoLida` fornece `recontarNaoLidasInbox` como esse callback. Falha não aciona a recontagem de sucesso, e a action de preferência não introduz SSE novo. A afirmação sobre outras abas é expressa como limite, sem garantia de atualização imediata (`0bc69c`). O link relativo `inbox-nao-lidas-menu.md#cliente-e-ciclo-de-vida` aponta para arquivo existente.
- C5: recalculei os blobs Git dos caminhos de `output` alterados: base própria `4ddd0fb5..d32e7411` = 23 arquivos/351.884 bytes/11.603 linhas; base posterior `dca8c5d5..0fcaf459` = 24/353.511 bytes/11.631 linhas (`403e9c`, exit 0). Isso mede tamanho dos blobs atuais, não só linhas adicionadas pelo diff. O ZIP de 142 PNG e seus hashes/fontes são referências históricas do autor; não baixei nem reauditei imagens.
- `git diff --check` pai..HEAD retornou 0 (`865e9f`). Nenhuma captura, teste ou alteração produtiva resulta deste commit.

Não executei Vitest, DB, browser, Prisma, instalação, typecheck, lint ou global por se tratar de MD. Os testes 7/53 UTC/SP e demais gates do DEV não são minhas execuções. C1/main/CI/retarget e integração final seguem com o integrador.
