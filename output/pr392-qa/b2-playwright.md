# PR #392 — B2: dependências Playwright

O usuário autorizou expressamente o integrador a alinhar manifesto/lockfile e executar `npm install --package-lock-only --ignore-scripts --offline`, seguido de testes. O comando foi executado com Node 22.23.2 e npm 11.13.0: executor `47463c`, saída 0. Não houve outro install nem execução de scripts de pacote.

## Alteração

`@playwright/test` e `playwright-core` resolvem 1.64.1, assim como a dependência `playwright` do runner. O lock altera somente essas entradas, a declaração raiz e o metadado dev de `fsevents` 2.3.3, cuja versão não muda. As integridades dos três pacotes coincidem com as da PR #280 em `bab2c9f9`.

A CLI exige `PW_CHROMIUM` em todos os sistemas, retirando o fallback Linux preso a uma revisão antiga. O guard de dependências verifica também a resolução real test → playwright → core e recusa divergência aninhada. Nenhum contrato de aplicação, schema, autorização ou envio foi alterado.

O npm preservou os quatro manifestos instalados consultados, mas atualizou o índice oculto `node_modules/.package-lock.json`. O preflight real recusou corretamente o core local 1.56.1 após a mudança do lock. O integrador alinhou somente a cópia física de seu próprio core com a versão 1.64.1 já disponível no runner local: 115 arquivos comparados por tamanho/SHA, preflight aprovado, `e75a60`, saída 0. A cópia anterior está preservada no mesmo worktree; nenhum outro ambiente foi alterado. Ambientes que receberem este commit precisam alinhar seu core antes de executar integrações.

## Verificação desta fonte isolada

| Gate | Evidência terminal |
|---|---|
| Regressão causal da trava | `0eee8d`: regra antiga, saída 1, uma falha e cinco passes; `737ae2`: regra corrigida, saída 0, seis testes. |
| Global unitário | `92630` / `829605`: saída 0, 846 arquivos e 6.543 testes, 350,24 s, maxWorkers=2; sem filtro de nomes ou skips acrescentados. A configuração exclui integrações. |
| Next typegen e TypeScript | Typegen gerou tipos; TSC final `92901` / `4f8a7c`, saída 0, heap 8.192 MiB. |
| ESLint global | `71193` / `c221e4`, saída 0, zero erros e 40 avisos herdados. |
| Integração visual, arquivo inteiro | `99228` / `b0ee48`, saída 0, cinco testes, maxWorkers=1, perfil ci-integracao exclusivo. Não é a suíte completa de integração. |
| DOM em Chrome local | `12b89d`, saída 0, um teste de anonimização, sem skips, com core 1.64.1. Não é recaptura do ERP nem substitui as evidências sanitizadas anteriores. |

As primeiras execuções de lint/TSC foram interrompidas com saída 1: o backup físico do pacote antigo estava em `output`, caminho varrido pelas ferramentas. O backup foi movido com verificação dos limites absolutos para `node_modules/.erp-backups`, excluído pelas configurações existentes, e somente esses gates foram repetidos. Nenhuma configuração ou fonte foi afrouxada para ocultar o diagnóstico.

Esta evidência pertence ao patch B2 isolado sobre `c57c8214`. A composição posterior com a main, a conferência de conflitos com #280, a revisão independente no SHA final e a CI final contra main permanecem etapas separadas. Não reatribuir estes gates à composição futura sem verificar o delta. Os PNGs antigos permanecem fora do código; integração final por squash preserva essa ausência no histórico da main.

## Composição com a main

Patch isolado: `68974544ec64363255f30111ffd0074f8f478907`. A main `cce21e19` foi incorporada por merge. Os conflitos produtivos vieram da base E0 antiga, sem mudanças exclusivas da #307 nesses arquivos. Para preservar as revisões já integradas, `src/` e `scripts/` foram conferidos contra a main, mantendo apenas a lista explícita dos dez arquivos do harness e dos quatro testes/guard de dependências da #307/B2. O delta desses diretórios contra a main contém exatamente esses 14 caminhos; nenhum contrato de E0 foi substituído pela versão antiga. Package/lock e eslint permanecem iguais ao patch B2 isolado. Os demais conflitos de SPEC/relatórios de funcionalidades anteriores conservam os arquivos da main. Os dois conflitos do quadro conservaram literalmente ambos os lados, removendo apenas os marcadores com um parser de estados e contagem de blocos verificados (`c412b6`, saída 0).

Recorte da composição antes do commit: `b21319`, saída 0, dois arquivos / 20 testes, syntax check da CLI, preflight real de dependências e diff check. O global/TypeScript/lint/integração desta composição serão registrados separadamente após suas execuções.

### Compatibilidade com #280

O merge-tree do patch isolado com `bab2c9f9` ainda sai com conflito textual em package/lock (`649847`). A inspeção `903cfe` mostra que os dois conflitos agora contêm somente a linha de `@babel/standalone` 7.29.0 deste harness contra um lado vazio da #280. Não há conflito de versão, resolução ou integridade do trio Playwright. A dependência Babel é necessária para servir o protótipo offline e deve ser preservada na integração da #280; não removê-la para tornar o merge automático. Trata-se de uma resolução textual determinada pelo consumidor existente, sem decisão de produto. Este relatório não declara merge-tree limpo com #280.

## Gates da composição c7

Fonte `c7bae481f099fc3c7d237b9fe81132c89968d948`, congelada durante os gates. A conferência `d8674c`, saída 0, confirmou `src/`, `scripts/`, `prisma/` e package/lock sem alteração durante a execução.

| Gate composto | Evidência terminal |
|---|---|
| Global unitário | `65804` / `c1315c`, saída 0, 849 arquivos / 6.651 testes, 236,80 s, maxWorkers=2, sem filtro de nomes ou skips acrescentados; integração excluída pela configuração. |
| Next typegen / TypeScript | `26045` / `9a91b5`, saída 0, tipos gerados e TSC sem erros, heap 8.192 MiB. |
| ESLint global | `60950` / `59613a`, saída 0, zero erros / 40 avisos herdados. |
| Integração visual, arquivo inteiro | `47303` / `ea3111`, saída 0, um arquivo / cinco testes, 33,36 s, maxWorkers=1, banco ci-integracao exclusivo. |

O teste Chrome `12b89d` continua nominal ao patch isolado; os helpers e a CLI do harness na composição c7 são byte a byte iguais aos testados, sem recaptura do ERP. Este registro posterior acrescenta somente documentação. A revisão independente c7, a CI remota contra main e o merge continuam pendentes nesta etapa. Nenhum resultado local é apresentado como check remoto.
