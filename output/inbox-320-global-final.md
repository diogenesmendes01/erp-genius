# Regressão integrada #320 — acompanhamento

Fonte ROOT `442d1a665e82c7376ce7e8707b3a4d365257c7db`: produção `b5094856c326c4fdf559b1833dbe0827868b591a`, patch de testes `491de47c06403c96724b09701bbc20a187d1ae59` e documentação da PR405 `4af3286df9c5870b317f47553ec8bb3b96189831`. Comparação src/scripts/prisma/dependências contra b509 mostrou somente os dois testes SSE alterados. Nenhuma mudança de schema, provedor, autorização ou transporte.

Node 22.23.2 e dependências locais já instaladas, sem instalação ou alteração do lockfile. Banco descartável ROOT: perfil `integracao`, banco `erp_genius_test`. Apenas uma suíte de integração usa esse banco por vez; configurações MOTOR e demais provedores externos estão vazias.

| Gate ROOT da fonte 442d | Evidência terminal |
|---|---|
| Unitário global, maxWorkers=2 | Sessão 69820, confirmação 10ce80: saída 0, 904 arquivos e 7.103 testes, 286,57 s. Sem filtro por nome ou skips acrescentados; a configuração unitária exclui integrações. |
| Next typegen e TypeScript com heap de 8.192 MiB | Sessão 5809, saída 0; tipos gerados com sucesso, TSC sem erros. |
| ESLint completo, max-warnings=40 | Sessão 89210, saída 0; nenhum erro e 40 avisos herdados. |
| SSE: integração dirigida, arquivo inteiro | Sessão 5423, confirmação 419897: saída 0, um arquivo e 11 testes, 50 s, sem filtro por nome. |
| Recorte Inbox de integração | Sessão 78114, confirmação 648f73: saída 0, 15 arquivos e 138 testes, 546,02 s. Arquivo inteiro em cada alvo, sem filtro por nome ou skips acrescentados. Este recorte não representa todas as integrações do ERP. |

Os logs privados correspondem a `output/inbox-320-442d-global-{unit,typegen,tsc,lint}.log`, `output/inbox-320-442d-sse-integracao.log` e `output/inbox-320-442d-integracao.log`. Não entram no pacote visual nem no Git.

Os 15 alvos integrados foram os oito arquivos `src/server/inbox/*.int.test.ts`; `src/server/whatsapp/{nota-interna,acesso-atendimento,linha-comercial,consultas-acoes-atendimento}.int.test.ts`; `src/server/academico/visibilidade.int.test.ts`; e `src/test/{visual-inbox,visual-inbox-entrada}.int.test.ts`. A configuração `vitest.integration.config.ts` usa `fileParallelism=false` e esta execução limitou `maxWorkers=1`.

A primeira tentativa de integração, sessão `80680` na fonte b509, terminou com saída 1: 15 arquivos, 138 testes, dos quais 137 passaram e um falhou. O teste de privacidade SSE usava uma proibição da substring `u9`, que apareceu legitimamente no ID público gerado. O formatador já retirava o campo privado. O patch 491 preservou os sete testes unitários anteriores, acrescentou um caso causal e mudou somente o caso integrado final para validar event/data/terminadores, JSON público e propriedade privada ausente; os IDs públicos contêm `u9` de propósito. Nenhuma mudança de produção ou autorização foi necessária. O resultado 80680 permanece uma falha histórica e não vale como gate aprovado.

Revisão independente TESTER do SHA 491: executor 8d3f52, quatro arquivos e 37 testes unitários, saída 0, sem banco; produção idêntica a b509 e diffcheck 0. Parecer: `output/inbox-320-sse-491-review-tester.md`.

O staging privado da #318, que acrescentava dois avisos de lint, foi arquivado pelo integrador fora da árvore da aplicação. Os 167 hashes e tamanhos permaneceram idênticos antes/depois, sem reparse points (cd236b). Nenhuma configuração ESLint, conteúdo de evidência, ZIP remoto ou arquivo rastreado foi modificado para alterar a contagem. Manifesto local privado: `output/inbox-320-staging-318-arquivado.json`.

Visual DEV na fonte 491, com produção idêntica a 442d/b509: preview ROOT 8165, porta 3110 e banco DEV A separado. Os 424 hashes e 551 registros originais da fixture foram conferidos em leitura (b94a4d, saída 0). A execução formal 36201 terminou com saída 0 e 164 PNGs (100 da aplicação e 64 do protótipo). O complemento 91340 terminou com saída 0, 40 contextos e 88 PNGs. Todos os 252 originais DEV foram inspecionados em 51 pranchas; a tabela possui 100 linhas, 64 comparáveis e 36 N/A de seis estados sem referência no protótipo. As imagens pertencem à fonte 491. Duas fotos formais de erro têm uma região independente ainda carregando, conforme os limites nomeados no relatório DEV e tabela; não comprovam estabilidade global da página.

O freeze documental DEV 9802809 foi integrado em ROOT 7a037ad. A comparação b2eec5 terminou 0 para src/scripts/prisma/dependências/AGENTS, idênticos à composição 442d dos gates. Nenhum teste global foi repetido por documentação. O preview 8165 foi encerrado em 465168; porta 3110 livre e banco DEV A restaurado com 424 hashes/551 registros originais em defae5, saída 0. A rodada privada 32366 do complemento foi negativa e inteiramente excluída; a repetição corrigiu somente seletores do probe privado. E1 ainda aguarda pacote, PR e revisão GitHub.

O probe TESTER 53837 terminou com saída 0, 12 candidatas e seis contextos. Uma dúvida visual nas duas imagens selecionadas em 320×500 motivou o diagnóstico geométrico ce150f, saída 0, nos dois temas: rodapé entre y357 e y500; textarea x172/y442/w80/h44, terminando em y486; cinco controles inteiros entre y442 e y486, com interseção integral com viewport/ancestrais e acesso por Tab real. O documento mede 500/500.

O placeholder quebra dentro da largura de 80 px: clientHeight=42, scrollHeight=102 e overflow=auto. Um rascunho fictício de 420 caracteres teve scrollHeight=1462, scrollTop=1407 e caret=420 acessível, sem submit ou envio. Portanto não há corte do controle ou rodapé; a primeira imagem não comprova cabimento de todo o placeholder ou conteúdo interno sem rolagem. As quatro fotos diagnósticas ficam privadas; as 12 originais podem ser qualificadas positivas com esse limite, após a allowlist final do TESTER. O preview TESTER 14688 foi encerrado (4853ee); porta 3109 livre e banco com 424 hashes/1.386 registros originais restaurado em fa0de1, saída 0. Nenhuma mudança de produção foi feita por essa investigação.

## Pacote remoto de evidências

As allowlists finais contêm 164 imagens formais DEV (SHA2397b2ae…), 88 complementares DEV (SHA54a54dca…) e 12 TESTER (SHAdcad80b8…), todas inspecionadas e com fonte visual 491. Packer 97c21a e compressão 84d3be terminaram com saída 0: **264 PNGs e 272 entradas**, incluindo seis pareceres/SPEC/relatórios em Markdown, tabela curada e manifesto.

ZIP `inbox-320-evidencias-442d.zip`: **23.677.284 bytes**, SHA-256 `d4f0168d80a248b081adaa1fabca426b789734aee7b0d0c53cdcdfe54cf5c0a4`. [Download autenticado da release em rascunho](https://github.com/diogenesmendes01/erp-genius/releases/download/untagged-fa5a4dab1bbf8d54cb05/inbox-320-evidencias-442d.zip). Release confirmada como DRAFT em33f312; upload6f5778 e download0785d3 terminaram0, com tamanho, SHA e sidecar idênticos ao original. Nada foi publicado ou substituído. Metadados completos: `output/inbox-320-evidencias-remotas.json`.

O relatório dentro do ZIP é o checkpoint anterior ao upload; este registro posterior em Git não altera o arquivo remoto. A auditoria independente LOCAL do ZIP pelo TESTER terminou com saída 0 e parecer favorável: 272 entradas exatas, 271 arquivos com hashes/tamanhos conferidos contra as três allowlists e originais físicos; tabela de 100 linhas e bijeção das 164 imagens formais, sem extras, caminhos duplicados, traversal ou tipos proibidos. Há 14 pares de PNGs com bytes idênticos sob nomes de estados diferentes, declarados nas allowlists; não representam arquivos ou caminhos extras. O roundtrip remoto foi executado pelo integrador. Parecer: `output/inbox-320-pacote-review-tester.md`.

A implementação e validação técnica da #320 estão prontas para PR. CI, revisão GitHub, integração dos predecessores e merge em main permanecem pendentes; a issue não foi marcada fechada ou aceita em produção. Todos os previews e navegadores foram encerrados; os bancos A/TESTER foram restaurados aos snapshots originais. Nenhuma próxima funcionalidade foi implementada antes deste fecho técnico E1.
