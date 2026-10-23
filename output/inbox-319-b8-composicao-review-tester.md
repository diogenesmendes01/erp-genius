# QA estática independente — composição final #319

Fonte testada: `b8edd5d39298dac617f65060098f6a5d66786159`, merge de `4fade8995573d1a9abaa343e9fa25295506f0cbf` (#319) com `741f595e1f9f32cd3511cbba6808bcd005e1c9c8` (#403). **Parecer estático favorável à composição**, com os limites abaixo. O head documental posterior `176903280c3007c3b839735a16090f408419b016` tem executáveis byteiguais ao SHA testado.

## Identidade da fonte

- `git diff --name-status 4fade..b8 -- src scripts prisma package.json package-lock.json pnpm-lock.yaml` mostrou apenas nove fontes/testes de C3/produtores visuais. Não houve delta na CLI e harness de estados #319, `InboxNovo`, `ConversaAberta`, `PainelSetor`, `Esqueleto`, banco ou dependências. Comparação dirigida `git diff --quiet` saiu 0, sessão `5e7853`.
- Contra `741f..b8`, as mudanças executáveis são as fontes, testes e scripts próprios de #319. Compositor, rascunhos, seu teste React real, Ações, `estado-visual`, `prazo-atendimento`, `prazo-vivo` e Avatar foram conferidos byteiguais a `741f` (`git diff --quiet`, sessão `c1dbd1`, saída 0).
- OIDs representativos no `b8`, idênticos às respectivas bases: `estados-inbox.mjs` `c9edab31`, `nucleo-captura.mjs` `f01cdf83`, `InboxNovo.tsx` `ee3e6047`, `ConversaAberta.tsx` `f5b74375`, `PainelSetor.tsx` `b5390272` (#319 `4fade`); `Compositor.tsx` `19c3c526`, `rascunhos-conversa.ts` `3c710809`, `estado-visual.ts` `ee565ffc`, `prazo-atendimento.ts` `ad8e3dab`, `Avatar.tsx` `cf711c06` (#403 `741f`). Conferência `c8092c`/`13270d`, sessão concluída **exit 0**.
- `git diff --check 4fade..b8`: sessão `6f6929`, exit 0. Checkout exato e nenhum arquivo rastreado alterado, sessões `510d56` e `ac7836`, exit 0.

## Recorte próprio

Node 22 local / Vitest, sem banco: `visual-inbox-estados`, `visual-inbox-estados-fluxo`, `visual-inbox-falha-controlada`, `visual-inbox-conclusao-thread`, `Compositor.rascunho.interacao`, `Compositor`, `estado-visual`, `estado-visual.servidor`, `prazo-vivo`, `Avatar`, `Esqueleto`, `ConversaAberta` e `PainelSetor`. Sessão `137c14`: **13 arquivos, 212 testes, exit 0**, `--maxWorkers=2`, sem filtro de nomes ou skips reportados.

## Extensão documental e limites

`176903280c3007c3b839735a16090f408419b016` modifica somente sete caminhos de documentação/relatório contra `b8`; `git diff --quiet` em `src`, `scripts`, `prisma`, package/lock e `.gitattributes` saiu 0 (sessão `06f378`), e `git diff --check` saiu 0 (sessão `c4d93a`). O parecer estático se estende por identidade executável, sem repetir o recorte.

Esta execução não foi suíte global, TSC, integração ou browser. O global/TSC/lint informados pelo integrador e a captura longa de seis contextos do DEV B são evidências externas; esta revisão não presume que suas imagens longas já foram inspecionadas ou incluídas em allowlist. As minhas 32 PNGs ERP históricas de `5e9` e as imagens do harness `4fade` não são recapturas da composição C3. Triagem, restauração do banco, pacote QA e publicação seguem pendentes na coordenação.
