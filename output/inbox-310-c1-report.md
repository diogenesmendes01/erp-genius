# PR394/#310 — revisão C1: lote da lista e contagens

Estado DEV final: fonte isolada corrigida b2338414e44845d6c3d830c2a3233966e4072b31 sobre eb68; porte agregado corrigido 3a005097678bb15ec3fde14af4f4175cba8c279d sobre676. As duas linhas permanecem separadas, sem merge313→310. Revisão independente e medição browser coordenada concluídas no porte3a; adoção, global e publicação competem ao integrador. Os checkpoints82/b494 e seus negativos são históricos e não foram adotados.

## Achado e contrato aprovado

Review R1 [C1](https://github.com/diogenesmendes01/erp-genius/pull/394#pullrequestreview-5622137351), reclassificado HIGH no [comentário de classificação](https://github.com/diogenesmendes01/erp-genius/pull/394#issuecomment-6353900745): cada aviso SSE e resultado de leitura podia disparar primeira página+5count+consulta pessoal. A otimização fica no consumidor, sem alterar SQL/API/autorização/regras das contagens.

criarAtualizadorEmLote agrupa numa janela FIXA50ms desde o primeiro pedido; avisos seguintes não adiam a fronteira. Máximo1GET da primeira página incluindo consumo do corpo HTTP, mais1flag de pendência consolidada. Ao terminar, uma pendência real agenda só uma próxima janela; não existe retry autônomo/polling/timer permanente. HTTP não-ok consome arrayBuffer antes de liberar o voo; sucesso já aguarda json. Sem abort/reclassificação de rede.

Thread/aviso de permissão/painel/ação de leitura continuam imediatos. Resultado de leitura sucesso/falha usa a mesma fila: se houver GET mais antigo aberto, exige trailing fresco após o corpo dele, mesmo se seu snapshot for descartado. Identidade/versão/fase da leitura, filtro e pedido são capturados no início REAL do GET. Preserva integralmente os guards existentes; não calcula agregados por linha nem impõe piso por mensagens.

Mudança da chave pública real de filtros cancela somente o timer/pendência antiga e invalida o contexto do voo, sem liberar corpo em andamento. Objeto SSR equivalente mantém a pendência pessoal; as invalidações de snapshots existentes continuam. A→B→A usa geração para descartar A antigo e captura A atual no próximo GET. Cleanup cancela timer, invalida aplicação e impede reabertura; StrictMode React real comprovou setup→cleanup→setup com1timer/1execução. Teste sobre DOMmínimo usa ReactDOM real, sem layout/browser; prova visual/HTTP real ainda necessária.

## TDD e cronologias

- RED consumidor original a14234 EXIT1, filtro -t C1:3falhas comportamentais (20SSE→20GET imediato;200/503 permitem GET2 enquanto body1 aberto),2antigos pass/23skip porque C1 também aparecia no nome. Não é suíte completa.
- RED helper4b7700 EXIT1 foi import inexistente, não falha comportamental. Helper novo implementado depois desse RED; a evidência comportamental principal é o consumidor original.
- Primeira adaptação do script parou antes de gravar Inbox por CRLF; log green-inicial na verdade permanece negativo3casos. Corrigida a normalização do script, não produção para acomodar o teste.
- GREEN novos bebec1 EXIT0:10pass/25skip. Depois recorte semfiltro6707f6 EXIT0:35/35.
- Testes antigos que concluíam GET imediatamente agora avançam50ms ANTES de concluir a ação/trocar seleção, provando snapshot efetivamente iniciado na fase antiga. Sem esse avanço, o GET seria fresco por definição, e a premissa antiga seria falsa.
- O antigo teste resolver[1] antes de resolver[0] foi substituído pela cronologia serial: GET0 inicia, novoSSE deixa uma pendência, snapshot0 chega20, só depois inicia GET1 que termina3; valor final continua o mais recente. Nenhum segundo corpo em paralelo para simular ordem.
- Falha de leitura com GET anterior aberto antes criava3consultas; agora1antiga+1recuperação consolidada, sem perder restauração após falha nem o GET fresco que corrige depois.
- Contexto equivalente: RED3ff7eb EXIT1,1fail/33skip porque cancelamento por mera identidade apagava o timer. GREEN44d090 EXIT0:42/42 após cancelar somente chave pública diferente. Caso forte conclui leitura sucesso/falha com body antigo aberto e recebe prop/filtros de identidade nova mas mesmo valor antes de fechar esse corpo; exige GETfresco final. A fixture mantém a nova prop a partir desse instante, sem alternar de volta ao objeto antigo a cada render.
- StrictMode teve negativo c2b9401fail/40pass por contar também setImmediate interno do Scheduler como timer da fila. Corrigido isolamento do relógio do teste para setTimeout/clearTimeout; implementação não alterada por esse negativo.

## Gates e limites

Recorte54301 EXIT0:24arquivos329testes, sem filtro por nome/skip, maxWorkers2. Comando Node22 local vitest run src/app/(app)/inbox + consultas-pagina.test/filtros.test/opcoes-filtro.test/routeatendimentos + identificacao-registro.test/confirmacoes.test. Inclui sem-polling. Warnings SSR useLayoutEffect da VirtualList/Balao antigos foram preservados, não silenciados. Lint4fontes967cd5 EXIT0/0avisos. Nenhum global próprio, DB/preview/deps/schema/transportes.

TSC93642 EXIT2 somente .next/dev/types/validator.ts2024 referenciando rota nao-lidas311 ausente neste head310. Nexttypegen gerou .next/types atuais, mas preservou cachedev; rodada91272 terminouEXIT2 no mesmo artefato antigo. Não é falha de produto. Integrador limpou exclusivamente5arquivos gerados B/.next/dev/types, operação c2cade EXIT0 e destino absoluto validado. TSC5951 terminou com saída0 após essa limpeza, heap8192; nenhum arquivo gerado foi incluído.

Logs negativos/positivos completos preservados localmente em output/inbox-310-c1-*.log, foraGit. Não transportar caminhos/logs brutos no PR. A entrega C1 ainda pede porte sobre676 preservando R6/syncURL/ACK150/SSRúnico/finally311/automático f51, gates desse porte e complemento coordenado; capturas4f anteriores não provam este novo agendamento.

## Checkpoint PARCIAL do porte sobre676 — P2 aberto, NÃO adotar

Conciliação em codex/inbox-310-c1-porte preservou contratos R6/IDs/counter independente/freshzero, f51automático/finally311, syncURL/ACK150/SSRúnico e VirtualList sem alterações. Somente executor assíncrono/fila/bodydrain; helper byte-equivalente ao isolado82. Conflitos em InboxNovo, testes e quadro conciliados por contrato, sem wholeours/theirs.

Porte inicial955259 terminou4falhas/72pass: quatro fixtures ainda resolviam corpo antes da fronteira50ms. Avançar50ms ANTES de status-pre-entrada/status-antigo/status-pos-pedido e do Linknull preservou o adversário real e todasasserçõesR6. GREEN43c12f76/76; complemento7add0978/78incluiu150+ACKfiltrosnovamesmoValor+leiturafinal/bodyantigo e navegaçãoREALnullcancelatimer. Retirada temporária sóda condição versaoNavegacao gerou REDdeaf3a:1fail/69skip, GETextra apósnovo contexto; restaurada imediatamente em finally. Não alterou syncURL existente.

Recorte atual48154 EXIT0:56arquivos622testes semfiltro/skip, maxWorkers2; typegen/TSC64437heap8192 EXIT0; lint4fontes94055b EXIT0/0avisos. Warnings herdados de SSRVirtual e fixture de prazo comkeyduplicada foram mantidos integralmente, não ignorados. Esses gates descrevem este checkpoint PARCIAL, não aprovação do P2 abaixo.

TESTERexato82 encontrou P2 real: GET SSE inicia, chegam props filtros de nova identidade/mesma chave, effectincrementa aplicada e descarta body sem criar pendência; contagem ficaSSRvelha. A fixture anterior cobria caso com pendência jácriada por fim de leitura, não SSEisolado. A correção precisa manter guards e avisar fila da invalidação de voo no MESMO contexto, produzindo trailing fresco; não se adotará82 nem este porte antes de novosRED/GREEN. SemDB/preview. Negativo independente em output/inbox-394-equivalent-private.test.ts doTESTER, originalpreservado. Próximo commit corretivo será isolado sobre82 e portado aqui; este checkpoint sópermite trocarOWNbranch semperder trabalho.

## P2 pós-review: props equivalentes invalidam GET em voo

82a7a32f é checkpoint HISTÓRICO, não aprovado para adoção. TESTER reproduziu SSE sem leitura: ao atualizar props com outro objeto filtros de mesma chave DURANTE o body, o guard incrementa aplicada, descarta o snapshot, e a fila antes ficava sem pendência. Estado pessoal permanecia2 em vez de3. A primeira fixture do DEV só cobria ACK com pendência já criada pelo fim da leitura, portanto não excluía este bug.

RED público3d0994 EXIT1:2fail/34skip. Sem leitura, esperado naoLidas3 recebido2; com leitura ainda pendente, esperados2GETs recebidos1. Usa Response/ReadableStream real com headers antes do body; não mocka o helper nem aguarda leitura para produzir o defeito.

Correção: invalidarSnapshotEmVoo marca1pendência somente se voo físico pertence à época numérica atual. O effect do consumidor continua incrementando aplicada e mantendo todos guards, mas avisa a fila antes disso quando as props são equivalentes. Contexto REAL mudou→cancelar; época cancelada nunca é reabilitada pela chave textual igual emA→B→A. Idle não consulta, timerprévoo jácapturará props atuais e mantém fronteira50ms,20invalidações no voo deixam só1trailing. Body continua serial e erro sem pendência não repete.

GREEN69cceb EXIT0:2arquivos47testes semskip, incluindo as duas variantes públicas e3novos testes do helper (idle/prévoo; lote20; épocaA→B→Aantiga). A leitura pendente continua recusando agregado; só seu resultado agenda a próxima consulta fresca na fase final, sem piso de IDs ou subtração heurística. Lint4fontes78e0c3 EXIT0. Recorte6764 EXIT0:24arquivos334testes semskip/filtro, maxWorkers2; typegen/TSC32952heap8192 EXIT0. Commit corretivo sobre82 pronto para revisão exata; permanece pendente porte mínimo sobre checkpoint parcialb494; QAindependente/browser/adoção pendentes, semDB/preview neste trabalho.

## Porte P2 corrigido — candidato para QA exata

Linha isolada PR394: b2338414e44845d6c3d830c2a3233966e4072b31 sobre82a7a32f sobreeb68. Linha agregada: b49414f0 sobre676026b3 recebe somente o commit corretivo b233 conciliado; não existe merge313→310. Histórico82 e porteb494 permanecem visíveis como checkpoints não adotados.

A conciliação do consumidor conserva a condição de cancelamento por chaveREAL OU versaoNavegacaoREAL e acrescenta else invalidarSnapshotEmVoo. ACKlocal/objeto equivalente não mudam época; guard existente ainda invalida resposta e fila garante trailing. Números de época impedem reviver vooA antigo ao retornarA. Helper byte-equivalente ao isoladob233. Todos contratos produtivos de leituraR6/autoridadefreshzero/IDs independentes/finally311/f51automático foram preservados: verificação por comparação de texto confirmou blocos de leitura/visibilidade/SSE iguais ao676 salvo as chamadas de fila; abrir() e todo JSX final são byte-equivalentes ao676. Sem toque emVirtualList/ConversaAberta/useDialogo/SQL/Next/deps.

Gates finais do porte, código observado:
- 9ed709 EXIT0:2arquivos83testes, semskip; inclui os47doisolado e contratosR6/URL/150. P2 público falso/verdadeiro agora recebe trailing; caso150preserva cursor/vista/Nova junto da reconciliação.
- 73762 EXIT0:56arquivos627testes semfiltro/skip, maxWorkers2. Recorte Inbox inteiro+componentesConversa+serverconsultas/filtros/opções/leituraautomática+APIroute+ASTidentificação/confirmações+tipografia. Inclui guardssem-polling, SSR/hidratação e VirtualList medido/stableMount. Warnings herdadosSSR/keyfixture preservados; não é suíte global.
- Typegen/TSC82827 heap8192 EXIT0; ESLint4fontes25da72 EXIT0/0avisos; diffcheck0. Nenhum gerado/dependência/AGENTS/next-env mudou.

Fonte disponível para review exato e medição browser coordenada após parecer. Sem DB/preview/install/ownfull/push. Capturas anteriores313 continuam atribuídas à fonte4f, e não comprovam este agendamento C1; requerem complemento pós-porte. Adoção/global/publicação seguem com integrador.

## Fechamento DEV — browser real no porte 3a, 23/10/2026

TESTER independente informou parecer favorável no SHA exato 3a:5 arquivos/106 testes, mais40 adversariais R6/P2 próprios, saída 0. Gates DEV continuam atribuídos aos SHAs corrigidos: isolado24 arquivos/334 testes e porte56 arquivos/627 testes, typegen/TSC heap 8192 e lint de 4 fontes sem avisos, todos saída 0. Fonte não mudou durante a medição; nenhum novo global foi executado pelo DEV.

Preview B3111 executor23046, Node22/Next16.3.5/Playwright1.56.1top/Chrome155, perfildev-gravacoes com provedores vazios e dados fictícios. Complemento UI26973 terminou saída 0:4 contextos em390 × 500 e1440 × 900, dois temas,20 PNG. Aplicar/remover/Limpar filtros, busca+chip, seleção de linha, fechamento de popovers, Tab/ShiftTab/Escape/CtrlMetaK e Link público rápido terminaram em/inbox com foco na busca. Não se aguardou assentamento de POST antes de navegar. Cada contexto manteve1 documento/timeOrigin, SSE máxima 1 e máximo1 GETlista+contagens até o corpo. Todas20imagens foram inspecionadas favoravelmente. Não houve submit/criação/envio nem E2E da actionNova.

O primeiro probe UIe7730c terminou saída1 por uma premissa privada: exigia recuperar GETmensagens da conversa que o próprio Link abandonava. Negativo preservado, sem classificar como defeito de navegação. O observador posterior comprovou AbortSignal→HistoricoConversa.limpar→commitHookEffectListUnmount, URL final sem aquele c e foco visível. O predicado privado aceita somente essa cadeia exata; o classificador global e os guards React/rede permaneceram intactos. Traces/stack/logs brutos ficam privados.

Probe de lotes76702 terminou saída 0,124 notificações reais recebidas, zero falhas/diagnósticos. Somente ROOT emitiu pg_notify guardado em autocommit, sem alterar linhas. Resultados observados:

| Cenário | SSE recebidos | Span de entrega | GETs lista+contagens |
| --- | ---: | ---: | ---: |
| Lote1 |1|0 ms|1|
| Lote20 |20|50,7 ms|1|
| Lote50 |50|92,7 ms|1|
| GET real retido, depois 50 avisos |51|retenção explícita|2: inicial+1 trailing|
| SSR equivalente com GET retido |1|refresh instrumental separado|2: inicial+1 trailing|
| Leitura real com GET anterior retido |1|ação real200|2: inicial+1 trailing|

A janela configurada continua fixa50 ms; os atrasos efetivamente observados até o início do GET foram53/100,4/135,9 ms nos lotes1/20/50, sujeitos ao event loop e à entrega SSE. O teste não promete latência de parede50 ms. Não extrapola50eventos arbitrariamente distribuídos para uma única consulta.

Na retenção, route.fetch/fulfill preservou status/bytes reais (hash registrado), segurando a resposta ANTES dos headers do cliente. Não é prova de streaming; o body aberto com ReadableStream real permanece coberto pelos unitários. O refresh RSC real mudou identidade de filtros1→2 com chave{} e seleção null constantes, sem fabricar props ou emitir outros avisos: o snapshot invalidado conservou exatamente1 trailing fresco. A leitura da Beatriz respondeu200 e também reconciliou depois do corpo antigo. As5 contagens DOM finais coincidem com HTTP fresco (158/102/76/107/55); não lidas já era 76, portanto não se alega decremento nesta fixture.

No probe inteiro:10 GETs concluídos (incluindo calibração), máximo1 HTTP viaCDP e1 fetch até consumir corpo,1 documento/timeOrigin e1 SSE simultânea. StrictMode criou/fechou a primeira instância antes da segunda, sem sobreposição. Duas imagens finais foram inspecionadas com lista correta antes da leitura e Beatriz/conversa/painel após ela; não há painel vazio nem estado indevido.

Allowlist positiva explícita em output/inbox-310-c1-allowlist.json:22 PNG,1.771.729bytes, cada arquivo com bytes/SHA256/tipo/fonte 3a/inspeção. Resumo sanitizado em output/inbox-310-c1-evidencias.json separa métricas, sessões, hashes de probes e limitações; não contém corpos, RSC, cookies, HTML ou traces. Scripts e manifestos brutos continuam locais, foraGit/ZIP. Capturas3134f/2e e676 permanecem imutáveis, sem reatribuição ao schedulerC1. Nenhum PNG novo foi incluído no Git.

Todos os browsers foram fechados antes de ROOT parar23046 (CtrlC/saída1 esperada). ROOT informou restauração f809d6 saída 0 com424 hashes originais/1.372 linhas e fixture3 mensagens/1 nota; DEV não executou SQL/seed/suíteDB. Depois do stop foi conferido e removido exclusivamente o bloco Next gerado  em AGENTS. Depósito remoto/global/adoção/publicação seguem com integrador; não há homologação presumida.
