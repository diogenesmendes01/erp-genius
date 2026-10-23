# PR394/#310 — revisão C1: lote da lista e contagens

Estado DEV: implementação isolada sobre eb68e31423333222a6bbe96284dfba9c45246ab8, branch codex/inbox-310-c1. Não incorpora #313/R6/automático nem suas telas. O porte no agregado atual é outro SHA;676026b3 e artefatos313 permanecem imutáveis. Revisão independente, medição browser e publicação aguardam integrador.

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
