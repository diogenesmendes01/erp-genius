# Selo pessoal de não lidas no menu — #311

Implementação da E1 Task6 sobre #299 e #310. O menu conta **conversas pessoalmente não lidas em todo o escopo**, igual ao chip Não lidas sem filtros. Três mensagens numa conversa contam uma conversa. A Sidebar continua com 224px e o selo conserva classes/tamanhos existentes; esta entrega não redesenha a casca da #308.

## Servidor e autenticação

condicaoNaoLidaPessoal foi extraída sem mudar sua regra: marcação pessoal explícita; ausência de leitura pessoal com contador compartilhado positivo; ou ENTRADA posterior a lidaAte pessoal. consultas-pagina e contarConversasNaoLidas usam a mesma condição combinada com escopoAtendimentos. Sem papel Inbox a contagem retorna zero antes de qualquer consulta.

GET /api/inbox/nao-lidas exige sessão e papel em cada chamada, responde { total } com Cache-Control: no-store, 401 sem sessão e 403 sem acesso. Contagens não seguem filtros da lista nem o tamanho da página. Não há schema, migração ou permissão nova. A função legada contarNaoLidas não faz parte da API ativa: a revisão pós-merge C4 abaixo remove sua soma compartilhada, sem alterar contarConversasNaoLidas pessoal.

## Cliente e ciclo de vida

assinarEventosCompartilhados mantém uma EventSource por aba, inclusive Sidebar, BarraMobile, Drawer e Inbox juntos. Cada assinatura tem identidade própria; limpeza duplicada é idempotente e a última assinatura fecha a fonte. StrictMode pode criar fontes sequenciais, nunca duas simultâneas. Callbacks antigos de fonte encerrada são ignorados. Reconexão nativa gera resync; assinante novo de fonte já conectada recebe resync dirigido para cobrir o intervalo do snapshot SSR. Falha de um ouvinte não impede os demais.

useEventosInbox conserva assinatura e API antiga reexportada. A loja useSyncExternalStore só é criada no browser durante subscribe, sem fetch ou mutação global durante render/SSR. O snapshot SSR é a prop inicial. Nova assinatura/prop SSR reconta mesmo quando outro consumidor continua montado, pois leitura pessoal pode não gerar NOTIFY. Zero oculta o selo sem remover a assinatura. BarraMobile sem navegação Inbox não assina a loja.

A loja reage a mensagem.nova, atendimento.atualizado e resync; mensagem.status não reconta. Há no máximo um GET em voo e uma repetição pendente. Rede/5xx/JSON inválido preservam último total; a repetição pendente também escoa após erro. 401/403 limpam total e pendência. Último unsubscribe avança geração e descarta resposta antiga, inclusive JSON tardio; remount espera o voo antigo terminar antes da busca nova. Sem polling. InboxNovo apenas chama recontarNaoLidasInbox no finally de marcarAtendimentoLido; reconciliação otimista e proteções #299/#310 permanecem.

## Demo e prova visual

demo-inbox.ts --entrada thiago aceita somente uma das sete chaves fechadas e exige fixture BAILEYS desconectada no banco local de teste permitido. Insere ENTRADA fictícia e atualiza contadores dentro de transação. O trigger existente publica mensagem.nova após commit; não há NOTIFY duplicado ou envio por transporte.

capturar-selo-inbox.mjs é o harness dedicado coordenado com #308. Exige exclusivamente dev-gravacoes/localhost:54329/erp_genius_test_dev_gravacoes e IDs fictícios exatos. Prepara só preferências pessoais de Admin: Thiago/Ventura marcadaNaoLida=true e lidaAte=null, outras cinco lidas; preserva compartilhados/fixada/silenciada. Não restaura sharedcounter por SQL. Após abrir Thiago a regra existente pode zerar seu contador compartilhado, motivo pelo qual só lidaAte=null não basta para preparar outra rodada.

Ruling do Step5: conversa selecionada lê automaticamente entrada nova. Para provar subida estável, após 2→1 navegar Home desmonta a seleção sem recarregar. Entrada CLI então sobe a 2 nas duas abas. De volta ao chat, outra entrada reconcilia para 1 e não provoca loop. Essa etapa adicional preserva #299/#310.

Evidência em output/inbox-311-visual: 24 PNGs app (4 fases × 3 tamanhos × 2 temas), seis referências reais do protótipo offline, manifestos e pranchas. O protótipo possui outra navegação; comparação limitada a tokens/cores do selo, sem afirmar paridade da casca futura. Fotos esperam fontes, SSE/GET inicial, Drawer dentro do viewport e transições CSS finitas. Estilo só de screenshot oculta toast Next sem issues; diagnósticos continuam ativos. Tema/viewport não muda a largura da Sidebar (224px).

## Verificação e limites

Recortes e códigos observados em output/inbox-311-report.md e quadro-entregas. Integração dirigida foi exclusivamente no perfil dev-gravacoes, antes da preparação final/preview; não é suíte completa de integração. Captura final95056 exit0: 24 PNGs, zero falhas e zero diagnósticos. Cada aba teve SSE ativa/máxima1 e GET máximo1. Todas as 24 imagens e seis referências foram inspecionadas. Tentativas negativas preservadas separadamente são problemas do harness/preparo, sem alegar correção de fonte produtiva por causa delas.

Revisão independente e gate global integrado #308+#311 permanecem a cargo do integrador antes da publicação. Não há homologação presumida, push ou PR pelo DEV.

## Revisão PR396 B1 — recuperação de uma fonte CLOSED

O estado da fonte física segue readyState: CONNECTING mantém a reconexão nativa; CLOSED invalida seus callbacks, fecha o recurso e libera a referência compartilhada. Na revisão B1 isolada, só uma nova assinatura recuperava a fonte; a revisão C6 abaixo acrescenta recuperação automática para os ouvintes que continuam montados. A rota continua exigindo sessão/papel.

Cada ciclo físico tem identidade própria, reservada antes de criar/instalar listeners. Encerramento definitivo libera essa identidade antes de notificar consumidores, inclusive se um callback síncrono montar outro consumidor. O retorno da instalação antiga não sobrescreve a fonte nova. Callbacks open/error/event atrasados da fonte antiga são ignorados. A primeira abertura da substituta entrega um resync coletivo para cobrir o intervalo desconectado; reconexão nativa mantém o resync existente. Cleanup/último unsubscribe e assinaturas com o mesmo callback continuam idempotentes e independentes.

O tipo FonteEventos inclui readyState somente leitura, compatível com EventSource. O argumento opcional de encerramento do helper é usado internamente pelo compartilhamento; os três argumentos existentes continuam válidos. Não muda hook, endpoint, autenticação, autorização, produtor, loja HTTP ou comportamento da leitura do Inbox.

### C1 — capacidade de operação

O compartilhamento é por aba: usuários autorizados mantêm uma SSE física inclusive fora da tela Inbox. Múltiplas abas multiplicam conexões e consultas de contagem; a loja conserva no máximo um GET incluindo corpo mais uma pendência por aba, sem consolidar abas. Em HTTP/1.1 os limites de conexões por navegador/origem podem restringir esse uso. Recomenda-se verificar e configurar HTTP/2 no proxy antes de operação com muitas abas; a negociação de streams não equivale a capacidade ilimitada. A configuração efetiva do proxy não foi verificada nem alterada nesta entrega. Referências: [modelo EventSource no HTML Standard](https://html.spec.whatwg.org/multipage/server-sent-events.html#processing-model) e [limites documentados pelo MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events).

Na revisão histórica B1/C1, C2 de base/CI pertencia ao integrador e C3–C5 ficaram diferidos. As revisões pós-merge abaixo substituem esse adiamento pelos resultados específicos, sem reatribuir gates ou capturas da fonte antiga. O relatório histórico output/inbox-396-report.md conserva sua origem.

### Revisão C6 — recuperação sem nova assinatura

Com assinantes ativos, CLOSED agenda uma única retentativa após1s, dobrando
para2/4/8/16s e limitando a espera em30s. Abertura bem-sucedida reinicia em1s
e entrega resync aos ouvintes antigos. Novo assinante antecipa a abertura e
cancela o timer pendente; último unsubscribe cancela timer/fonte e reinicia
o ciclo. Identidade do pedido impede que callback cancelado afete outro ciclo.
CONNECTING mantém exclusivamente o retry nativo; não há consulta periódica,
setInterval ou router.refresh. Falha síncrona ao construir substituta segue
o mesmo backoff, sem exceção solta no timer.

EventSource não expõe o status HTTP no onerror: falhas definitivas de sessão
também podem voltar a tentar com espera máxima30s enquanto houver assinantes;
nenhum pedido contorna autenticação. Sem assinantes não há tentativa. Esta
política de transporte não altera a loja GET, autorização ou regras do motor.

RED causal quatro falhas/oito passes; GREEN quinze testes de compartilhamento
e recorte quatro arquivos/34 testes EXIT0. Cobertura de limite/reset, teardown,
antecipação, callback cancelado, construção indisponível e CONNECTING nativo.
Global final01a: 860 arquivos/6.756 testes unitários, sessão22304 EXIT0,
sem filtros/ignorados,maxWorkers2,262,87s. TSC5638 e lint97309 EXIT0,
zero erros/40 avisos anteriores. TESTER01a favorável,seis arquivos/47 testes
próprios,execcb5243 EXIT0; sem DB/browser/global próprios.

Chrome/EventSource nativo com HTTP local real passou em dois cenários
(ff9c5d EXIT0):503→retry1008ms→200 com dois ouvintes sem remontagem/resync;
200 fechado→CONNECTING nativo→200 com o mesmo objeto. Teardown após CLOSED
ficou1300ms sem novo pedido e remontagem posterior abriu200. Máximo uma
stream ativa, um documento/foco externo preservados,zero pageerror.
Fixture do helper sem Next/ERP/DB/proxy externo; sem alegar zero console de
rede diante do503 deliberado. Duas capturas positivas inspecionadas.
ZIP inbox-pr396-c6-01a254f5.zip:38.437bytes/2PNG/5arquivos, SHA256
361b6f89e7e4dcc0eb59bcfdd3503910195b544b36f1575cf2baa1caee5190b0,
asset668211207/DRAFT421321214,download/hash confirmados. Report
output/pr396-qa/c6.md; composição dos dependentes/CI/main permanecem gates.

### Evidência B1 isolada

No SHA babd, TESTER independente favorável (7 arquivos/41 testes, saída0 informado pelo integrador) e probe browser d56ad6 saída0. Um503 controlado local levou o EventSource nativo a CLOSED, observado antes do callback produtivo. Sem nova fonte até o Link público Home→Inbox, que preservou a Sidebar e abriu uma única SSE real200; máximo1ativa e um documento/timeOrigin. Resync ao assinante antigo comprovado pela recontagem originada no fanout da abertura. Dois diagnósticos esperados do503exato, nenhum guard global alterado. Duas imagens inspecionadas e resumo/allowlist sanitizados em output/inbox-396-evidencias.json/output/inbox-396-allowlist.json. Não é deploy real, teste prolongado de capacidade ou prova estética do agregado atual. Porte/browser agregado/global/publicação permanecem coordenados pelo integrador.

### B1 no agregado315/396

Helper e testes byte-equivalentes a babd na fonte3b813. Repetição browser16dde0 saída0 comprovou503exato→CLOSEDnativo→nova assinatura pelo Link público com Sidebar preservada→SSE200real/resync, máximo1ativa/umdocumento. DoisPNG atuais inspecionados, semPG/SQL/envio. Resumo e allowlist atual-3b813 ficam separados dos isolados; sem nova lógica ou binário noGit. Gate global agregado permanece com integrador.


### Porte funcional C6 na composição319

Cherry-pick exclusivo01a254f5 sobre fad43 gerou88fb31d8, sem merge de ancestralidade do outro chat. Fonte/testeSSE OIDs39437068b4d81228af58f9499f31c6392d54684b e79a69e0aac722e76548efa013cb9511d3b5aaa13 são idênticos ao commit funcional. SóSSE/testes e estaSPEC/quadro receberam o porte; harness/CLI/estados319/C2/rodapé317 permaneceram intactos. Conflito sóquadro: históricos OWN preservados e seçãoC6 adicionada.

GateDEV Node22: recorte15393 terminou saída0/63arquivos577testes,15,25s,maxWorkers2, sem filtro de nome/skip; inclui SSEcompartilhado, todoInbox319, Selo/Sidebar/BarraMobile, histórico/useConversa/VirtualList, Esqueleto e fluxo/harness319. Lint2fontes6d1807 --max-warnings0 terminou0/0avisos; diffcheck nofreeze. Configuração unitária exclui integração: não é global, nenhum DB/SQL/browser/preview/envio foi executado. TSC37494 e recorte70/863 anteriores continuam históricos pré-C6, sem reatribuição àfonte portadas. Global/TSC final e extensão TESTER sobintegrador antesReady; provas visuais históricas não aceitam C6 por inferência.

### Revisão pós-merge C3/C4 — montagem e consulta legada

C3: o resync sintético de uma assinatura tardia preserva a atualização desde o snapshot SSR quando a fonte já estava aberta. A recontagem pessoal ao assinar também é necessária porque marcar como lida pessoalmente pode não emitir NOTIFY global. Montagem client-side pode, portanto, repetir GET de lista/painel/thread e da contagem, mesmo com valor SSR disponível. Esse é o custo redundante aceito para manter freshness; não se afirma consolidação, cancelamento ou ausência de pedidos extras que não foram comprovados. Nenhuma otimização de SSE, loja, fila394 ou leitura R6 foi introduzida por esta revisão.

C4: busca completa em src/scripts e no barrel consultas confirmou contarNaoLidas apenas na declaração e em duas assertivas de linha-comercial.int.test.ts, sem chamador produtivo. Conforme o pedido do plano, a função/export de soma compartilhada foi removida. O teste passa a chamar contarConversasNaoLidas, a consulta pessoal real do selo; mantém vendedor sem escopo=0 e gerente autorizado=1, além de todas as demais assertivas. Não há alias fictício, alteração de ACL, consulta ativa, handler ou API SSE.

Integração linha-comercial completa: sessão30761, um arquivo/24casos, terminal0, sem filtro/ignorados, configintegration/maxWorkers1 no perfil temporário integracao/banco descartável487 reservado pelo integrador. Transportes vazios, nenhuma mensagem externa. Não é suíte completa de integração; o bancoB490 não foi usado. O integrador restaurou o perfil dev-gravacoes após liberar a janela.

### Revisão pós-merge C5 — ligação real do hook

useEventosInbox.interacao.test.ts monta ReactDOM real e usa o hook e módulo de compartilhamento produtivos; somente EventSource é substituída por transporte falso sem rede. Dois consumidores mostram Desconectado/Conectado, recebem os avisos e compartilham uma fonte. Rerender atualiza o callback sem reinscrever; desmontar um consumidor mantém o outro, e o último fecha a fonte. StrictMode limpa ciclos antigos sem duas fontes ativas, callbacks posteriores ao descarte são ignorados e ausência de EventSource mantém desconectado.

Os três casos passaram na fonte original. Uma mutação temporária que congelava o callback no primeiro effect reproduziu uma falha/dois passes; o finally restaurou exatamente os bytes do hook, e GREEN6/49 mais o recorte amplo11/367 terminaram0. É prova de sensibilidade do teste existente em comportamento correto, não alegação de bug runtime novo. O hook, produtor, singletonSSE e loja não mudaram. Os três testes históricos do helper reexportado foram preservados.
