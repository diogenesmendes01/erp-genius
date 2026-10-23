# #319 — checkpoint estático dos estados do Inbox

OWNbranch codex/inbox-e1-319, base29479848432d2b4fd37972f104b6b7e5cae62368. Fonte aprovada da316/315/396 mantida; não houve checkout/edição de outro worktree. Implementação estática pronta para revisão e integração com A317, mas UI/QA/global/publicação ainda pendentes. Nenhuma captura foi produzida ou alegada nesta etapa.

## Delta e rulings

Quatro fontes produtivas: Esqueleto.tsx (casca real960/1100/1400, novos EsqueletoThread/Painel com anúncios), ConversaAberta.tsx (somente estados internos de thread/anteriores/erro e handoff local), InboxNovo.tsx (render de painel loading/erro e sem seleção), PainelSetor.tsx (ausência neutra). Nenhum contrato de props/hook compartilhado mudou.

Ruling aprovado: skeleton inicial exige ausência de mensagens E notas para não ocultar #388; EsqueletoPainel é apenas corpo, pois avatar/cabeçalho já estão no PainelContato #318. Esqueleto da página contém seu próprio avatar132 e um marcador de título, com CSS idêntica aos limiares reais da casca. Não usa painel1200 ou min-height420 históricos. Busy/retry mantêm conteúdo virtual e não expõem ErroFonte/status/URL/corpo.

Handoff síncrono antes do retry/anteriores ao campo de busca quando aberto, senão regiãoConversa; no painel, ao elemento real existente. Nenhum restore assíncrono. Comparação6d488f confirmou todo bloco inferior Compositor/ações/CabecalhoControlado byte-igual294 e hooksInbox de URL/leituraR6/fila394/SSE396/painel iguais294 (normalizando só CRLF). Mudou só a apresentação após os hooks. A317 poderá conciliar seu coordenador externo e idempotência sem perder esses estados internos. scripts/visual/CLI/núcleo/esperas/README permanecem intocados e reservados a A317.

## TDD e negativos preservados

- RED6ce4e8 saída1:9falhas/1pass/146skip no filtro319. Duas falhas eram exports dos novos esqueletos ausentes; as demais demonstravam casca antiga, loading sem anúncio, erro técnico exposto/semretry, ausência de alerta do painel, semseleção e estilo vazio. RaceA→B já passava. Recorte filtrado, não suíte completa.
- FocoRED inicial9b9bb1 incluiu um seletor de teste que achava ancestral em vez do botão; corrigido somente o seletor. REDfiel3f6a9a saída1:2falhas/1pass/7skip — retry inexistente e anteriores não entregava foco antes da carga. Não mudou produção para acomodar a seleção do teste.
- Script privado de aplicação teve erro de sintaxe detectado por node--check5613b3 antes de qualquer escrita produtiva; corrigido no próprio script privado. Nenhum helper temporário foi incluído na entrega.
- Primeiro GREEN46191c:12pass/1fail/153skip. A falha era cronologia do render manual da fixture: após retry faltava renderizar o efeito antes de aguardar. Acrescentado render imediato; produtor inalterado por isso. GREEN8ba89d saída0:7arquivos185testes sem filtro/skip.
- Handoff do painel: retirada temporária só da linha de foco produziu RED1fail/77skip; original restaurado emfinally. GREENbff840 saída0:1pass/77skip. DOM mínimo real comprova foco antes da remoção e respeito ao foco externo depois da resolução; não mede geometria de browser.
- Recorte5807 terminou saída1:61arquivos847pass/11fail. Nove falhas vinham do mock de ícones do teste DOM de foco sem IconMessages novo; duas eram registros de botões ainda antigos. Acrescentado ícone ao mock, três entradas exatas no mapa e removida somente a isenção raw de Mensagens anteriores, agora Botao. Sem alteração de algoritmo/limites/whitelist genérica.
- TSC62726 terminou saída2 somente pela fixture respostaPainel: retorno declarado Response não permitia as novas Promises diferidas. Tipo corrigido para Response|Promise<Response>, com Promise<Response> explícita. Não era erro produtivo nem problema de cache gerado.

## Gates finais observados

- Recorte9927 saída0:61arquivos861testes, sem filtro por nome ou skip, maxWorkers2. Inbox inteiro; Esqueleto/visibilidade; VirtualList/histórico; borda-rota render/estática; botões/estados-vazios/paleta/feedback; identificação/confirmações; SSE compartilhado; APIpainel. Não é global.
- Typegen anterior concluído; TSC13787 heap8192 terminou saída0 observado na mesma sessão. Nenhum arquivo gerado foi incluído.
- ESLint13fontes688eae terminou saída0, zero avisos. Diffcheck no freeze terminou com saída0. Aviso de vite-tsconfig-paths preservado no log, sem mexer em dependências.

Comando dirigido Node22 local: vitest run src/app/(app)/inbox src/components/Esqueleto.test.ts src/components/Esqueleto.visivel.test.ts src/components/conversa/VirtualList src/components/conversa/historico-conversa src/app/borda-rota.render.test.ts src/app/borda-rota.test.ts src/app/botoes.test.ts src/app/estados-vazios.test.ts src/app/paleta.test.ts src/app/feedback-separado.test.ts src/app/identificacao-registro.test.ts src/app/confirmacoes.test.ts src/lib/eventos-inbox.test.ts src/app/api/inbox/atendimentos/[id]/painel/route.test.ts --maxWorkers=2. TSC --noEmit --pretty false; eslint nas fontes/testes/mapa afetados. Logs positivos/negativos privados em output/inbox-319-*.log, foraGit.

SPEC docs/specs/inbox-estados.md. Ainda faltam TESTER exato, integração dos fragmentos A317, handoff do harness e prova visual obrigatória (5estados/3viewports/2temas,320×500 e complementos de retry/partials/foco), medição de geometria e globalROOT. Protótipo não prevê todos os estados; ausência de referência será explícita, sem fabricar comparativos. Não marcar319concluída no quadro enquanto isso faltar. Sem ownfull, DB/seed/SQL, servidor, envio ou integração externa; banco B permanece reservado/restaurado pelo integrador.


## Prova privada preliminar da fonte472 — formal ainda pendente

Fonte produtiva472e17fd3c44d2163a853a2f706b7fba1c6206a8 preservada, sem delta de produção/CLI. QA estática independente comunicada pelo integrador:11arquivos306testes saída0, favorável condicional. Não substitui inspeção/formal/global da composição317 e C2#402.

Probes privados Node22/Chrome local: semseleção a62951, thread2d7b25, vazio608110, página33841 e painel+paginação12443 terminaram saída0 observada. Dois contextos:1440×900 claro e320×500 escuro, sem matriz completa.29PNG/2.777.875bytes selecionados e inspecionados, identificados por fonte/tamanho/SHA em output/inbox-319-preliminar-allowlist.json; métricas resumidas em output/inbox-319-evidencias-preliminares.json. Imagens/manifests brutos/probes privados ficam locais foraGit, sem depósito remoto formal presumido.

GETreal autorizado de João para Beatriz comprovou200/COMERCIAL/oportunidade:null antes de aceitar ausência legítima. HTTP500 privado somente nos GETs exatos de painel ou mensagens; retry reteve resposta real200 sem modificar corpo e devolveu foco antes da carga, sem roubo após resolução. Nenhum outro status/erro foi descartado genericamente; cancelamentos substituídos seguiram classificador existente. SSE física máxima1 em todos os12contextos selecionados. Painel500 também torna indisponível a permissão do compositor, como já previsto no contrato existente.

No320×500, painel próprio top57/bottom500, clientHeight443/scrollHeight611/scrollTop0 e documento0: alerta486.5..558.5, retry514.5..558.5; foco inicialFechar. Em12443 Tab×2 desdeFechar alcançou retry real e o scroll próprio trouxe-o a346.5..390.5. Foto inicial sem rolar e foto alcançada por teclado estão separadas.9133 mediu foco programático antes deTab/ShiftTab, portanto serve apenas como geometria/histórico e não como travessia natural. Nenhum bugprodutivo foi corrigido por rolagem parafoto.

Paginação real60→120 ativou122itens decorados; carga retida preservou mesmaLista, mensagem, nota recente, campoBusca focado e semSkeleton inicial. Resolução tardia respeitou foco movido pelo usuário paraFecharBusca. Erro parcial manteve conteúdo/pin; alerta estava acima da janela por busca149 (desktop−8542/scrollTop8750; mobile−9977/scrollTop10345), docscroll0. Em12443 Tab×6 desdeBusca alcançou retry e rolou o scroller real, semfocus() artificial no destino; retry entregou focoBusca antes da carga. Final153mensagens+2notas+2dias=157itens, mesmaLista e pin000; Enter mudou2de2→1de2 eEscape devolveu foco visível. Nota privada foi fotografada durante carga e nota original reapareceu no histórico final. Essas provas de scroll/foco permanecem preliminares porque C2#402 ainda será incorporada.

Página: /home→Next router.push para /inbox com busca única, latênciaCDP3000ms, requestRSC real200 e mesmoTimeOrigin. Loading.tsx real foi observado e inspecionado, um marcador de título/anúncio; casca1440×900 e320×500 sem overflow. Não houve fabricação/retenção de HTML/RSC/props; isto não mede chunks/streaming. Semseleção não montou painel e respeitou centralvisível no desktop/lista no mobile; fixture não contémTriagem, logo ordem visual comTriagem presente NÃO foi comprovada.

Negativos preservados:8873 saída1 no mobile exigiaSidebar visível em breakpoint que a oculta; probe passou após aguardarattached+routerpronto, sem alterarproduto.90071 saída1 exigia1de2 após inserir página anterior; seleção149 persistida corretamente tornou-se2de2, então novo probe registra posição antes/depois e exige mudança. Nenhum negativo foi reatribuído a fonte corrigida. Fotos intermediárias com alerta fora da dobra permanecem históricas, não contam como controle visível. Tentativa de comandoPython inexistente falhou antes da escrita, substituída porNode22 sem instalação.

Browsers fechados após12443; ROOT encerrou preview22285 e restaurou snapshotbfa460 saída0/424hashes/1372originais/3mensagens1nota, semprivados319. DEV removeu somente blocoNext gerado deAGENTS após conferir equivalência comHEAD. Sem DBsuite/SQL/seed/startstopservidor/deps/envio pelo DEV. Fonte estática não mudou, portanto gates861/TSC13787/lint13fontes anteriores continuam atribuídos ao checkpoint472, sem novo global alegado. Faltam composição317+C2, handoffCLI, formal completo, Triagem presente se aplicável, TESTERbrowser/globalROOT/publicação.
