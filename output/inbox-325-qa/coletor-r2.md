# #325 — QA independente do coletor R2

**Favorável ao harness na fonte exata `96c9e60752b3c1951922a745cee89045b4597ace`; o P2 de coleta identificado em d1f51 está resolvido na ligação revisada e no recorte executado.** Árvore `816fc42b314f86d58d5f9eeff7aa6e0e41243265`. Gates próprios:17arquivos/150testes, TypeScript e lint4, todos EXIT0. Isso permite ao ROOT avaliar liberação da nova formal36; não é QA visual, nova captura ou homologação325.

## Fonte e ambiente

27473d EXIT0: checkout próprio96c, perfilintegracao, schema487 OID `1f575691cde242124c1493b8406121e8830a6f7e`, tracked limpo;6b327/ECC e1.040 arquivos privados anteriores preservados. Banco havia sido restaurado pelo ROOT em0ad146/424hashes após INT327; não foi usado nesta rodada. ROOT executou Nexttypegen a8d4ec EXIT0 depois do checkout; TSC só iniciou após essa confirmação. Nenhum Prisma/generate/install/DDL/cluster/INT/browser/HTTP/SQL/fixture/UI/Save/nota pelo TESTER.

f0c47c EXIT0 comprovou nove blobsAPP325 e diretórios de produto/servidor/lib/componentes/schema/package/lock idênticos a `ddf872e13078fb48c7648da9c2fc48b1d3f29438`. Os nove paths são InboxNovo.tsx, InboxNovo.test.ts, InboxNovo.interacao.test.ts, InboxNovo.detalhes.test.ts e abas/AbaDetalhes.tsx, AbaDetalhes.test.ts, BlocoB2B.tsx, useAbaPainel.ts, useAbaPainel.test.ts, todos sobsrc/app/(app)/inbox.

A mesma checagem comparou corpos AST/texto das cinco guardas953: esperarHidratacaoApp, semanticaPainelDetalhesPronto, semanticaRodapePronto, cancelamentoDeMensagensRecuperado e problemaReactNaCaptura. estados-inbox.mjs/SSE permanece inteiro igual953; semanticaDetalhes325Pronto igual ao pai364. Diff-check d1f51..96c0 e tracked limpo. Não se ampliou o classificador953 para aceitar Detalhes genericamente.

## Gates próprios completos

Executável Node22: C:/Users/Mendes/AppData/Local/hermes/node/node.exe.

| Gate | Sessão/terminal | Resultado |
| --- | --- | --- |
| Harness completo do recorte | 90c840 | EXIT0,17arquivos/150testes,2,93s |
| ESLint quatro pathsR2 | 831ea1 | EXIT0,zero avisos |
| TypeScript após Nexttypes | 27039/7f0498→2bd520 | EXIT0,sem diagnóstico |

```text
node node_modules/vitest/vitest.mjs run src/test/visual-inbox --maxWorkers=2
node node_modules/eslint/bin/eslint.js scripts/visual/capturar-inbox.mjs scripts/visual/coletor-detalhes.mjs scripts/visual/coletor-detalhes.d.mts src/test/visual-inbox-coletor-detalhes.test.ts --max-warnings=0
node --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit --incremental false
```

Sem filtros por nome ou skips nas saídas. O prefixo visual-inbox contém os17arquivos, não regressão global do APP. Há12 cenários novos do coletor, além dos138 anteriores; não somar gates repetidos como testes distintos. Aviso herdado vite-tsconfig-paths mantido. Uma tentativa administrativa de orquestração JS falhou antes do dispatch por SyntaxError; nenhum executor/teste havia iniciado nessa tentativa, não é RED do produto. As execuções acima foram acompanhadas até terminal0.

## Por que a correção elimina P2

Em d1f51, START só gravava ordem e a lista de Promises era alimentada em requestfinished.35abortado/38íntegro/48pendente podia passar a primeira espera; falha48 chegava depois da classificação. O parecer negativo original permanece íntegro. A reprodução causal privada7f1915 extraiu os callbacks exatosd1 viaGit e confirmou o falso verde em EventEmitter; é evidência DEV posterior, não runtime do TESTER nem validação visual.

Agora instalarColetorDetalhes325 cria deferred e registro porRequest no próprio START GET do endpoint exato, instalado antes da navegação. Headers ligam-se ao mesmo objeto; settled exige failure ou finished com body/fim/hash concluídos. tarefas/processando impedem tratar body iniciado como concluído só porque houve requestfinished.

aguardar usa prazo comum finito, snapshots sucessivos das deferred/tarefas e nova volta de evento para exigir zero pendências e versão estável. START/body acrescentado durante espera invalida o snapshot e entra no drain seguinte. Token é congelado, pertence aWeakSet e precisa da versão corrente para selar; prova de identidade/ID/DOM é validada e página deve estar ativa. Qualquer evento do endpoint depois do selo grava violação permanente. Timeout ou estado semSTART/headers/body/hash não vira sucesso.

A auditoria continua após context.close; nenhum listener é retirado nessa etapa. encerrar exige browser sem conexão, reaudita com prazo final limitado, verifica close confirmado/pendências/falhas e só então remove listeners. finalizarCapturasDetalhes325 agrega o resultado ao mesmo registro da captura. O CLI chama essa ponte depois de browser.close e só depois grava manifesto/imprimeOK/verifica falhas. Falha de fechamento produz erro ou auditoria conservadora, não aceite.

38 continua incapaz de recuperar48, pois o predicado preservado exige START posterior ao pedido que falhou. A antiga lista conclusoes pode continuar servindo às guardas legadas, mas não decide os GETDetalhes: esses abortos só saem do loop genérico porque o coletor dedicado irá auditá-los até o fim.

A captura é candidata até a auditoria final, não positiva por o screenshot existir. No caminho público325, a semântica é verificada na prontidão e no selo antes da foto; eventos posteriores são rejeitados conservadoramente. SSE/query/POST e outros endpoints ficam fora da barreira finita específica e conservam suas guardas; não se espera uma stream infinita.

## Oráculos da ligação executados

Os12 testes EventEmitter usam o mesmo módulo exportado e consumido pelo CLI:48 ainda em voo bloqueia a espera; falha48 não usa38 anterior; START durante leitura de body entra no drain; finished sembody/hash permanece pendente/timeout; token obsoleto não sela; START/failure durante finallyclose ou após auditoria parcial tornam a captura negativa; listeners só saem após browser fechado; falha de fechamento não confirmada reprova. Há também positivo35abortado/38e48íntegros, negativo body48 divergente e exclusão deSSE/query.

Esses oráculos atendem a lacuna de ligação que os23 casos do predicado puro não cobriam. O helper e a ponte reais são compartilhados; não é um simulador de algoritmo diferente. Não foi necessário executar navegador/DB ou criar nota para verificar oP2.

## Hashes e preservação

Manifesto próprio `output/inbox-325-96c-fontes-tester.json`:2.688bytes, SHA256 `18F311CC2530769FC28E2F5F2F8B8A27D455F6FA649603E1497D6FC2512D6C2E`, com seis paths, blobsGit e hashes físicos/GitLF.

- capturar-inbox.mjs: SHA256GitLF `fa471850a764759d9af30a739a473a8ca6d74ef4bb576cc00e934fb5dc2d0141`.
- coletor-detalhes.mjs: blob `4e31bfb304601a4a1b5ff575155c3b5a4e1fe458`,8.558bytesGitLF, SHA256 `52a2400bd31e802a00d8574f1296dda2bed3fb27d911ec9b25661130d8e85269`.
- visual-inbox-coletor-detalhes.test.ts: SHA256GitLF `44dc474ce4d74093c72c23288be4374b455604ad81434706421dba2d8670986a`.

918cc7/f3aa49 EXIT0 reconciliaram o hash físicoDEVfa3abdc...: é exatamente o blobGitLF do coletor com somente a última quebra emCRLF (8.559bytes). O meu checkout físicoCRLF tem8.693bytes/hash59ad6f..., mas normaliza ao mesmoGitLF52a240...; não houve diferença de código ou necessidade de refazer gate porEOL. Os namespaces não foram confundidos.

## Limites e próximos passos

O negativo d1f51, reprodução7f1915, primeiro lote26ab1b/PNG rejeitada e diagnósticoc588cb permanecem históricos/privados. c578af continua prova focada semPNG e não prova a barreira antiga; não foi reatribuído a96c. Os gatesDEV e a reprodução causal não são execuções próprias do TESTER. Nenhuma imagem antiga foi reclassificada.

Matriz190+30=220 foi preservada pelos testes do harness; a formal30+seis complementares320×500 ainda não foi realizada nesta QA. Geometria, conteúdo/capacidade/links reais, teclado e SSEmax1 em browser dependerão dessa rodada e inspeção offline posterior. O executor privadoB precisa usar o mesmo coletor/ponte do freeze, conforme compromisso registrado; o aceite continua sob coordenação ROOT. Este parecer não autoriza novosSave/nota/envio, upload/PR/merge nem substitui QA visual.
