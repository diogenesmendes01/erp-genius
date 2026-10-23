# Inbox E1 — fecho de componentes e travas (#320)

Estado: entrega DEV #320 congelada na fonte de código 491de47c06403c96724b09701bbc20a187d1ae59, com252capturas positivas inspecionadas e metadados curados. Global/integrações ROOT442d informados com saída0; QA independente favorável. E1 aguarda publicação/CI/decisão de aceite pelo integrador, sem homologação presumida. Node22.23.2; nenhum SQL/seed/integraçãoDB executado pelo DEV; preview isolado iniciado/parado e banco restaurado pelo ROOT.

## Recorte

PainelFiltros.tsx não tinha consumidor produtivo e foi removido. A coluna atual mantém PopoverFiltros, ChipsFiltro, SeletorNumero e filtros-url; o escopo é das consultas existentes. Os três testes do filtro antigo em ListaAtendimentos.test.ts foram aposentados junto do import/helper/mock/tipo exclusivos, preservando todos os testes da lista. A prova de setores autorizados permanece em PopoverFiltros/page/opcoes-filtro; abas/número em Chips/Seletor/Coluna.interacao; formato público dos parâmetros em filtros-url. A asserção paramsDaUrl({}).toString()==='' foi migrada explicitamente para filtros-url.test.ts. Só títulos/comentários obsoletos mudaram em InboxNovo/page.test/opcoes-filtro e seu testeint.

NotaNaThread e o export do componente AcoesAtendimento já estavam ausentes. O arquivo AcoesAtendimento permanece com hook/diálogos vivos, montagem única317, Nota por leitura individual inclusive ENCERRADO e ações bloqueadas pelo contrato vigente. Leitura/R6, SSE396, URL/ACK, decoração314, buscaC2 e revisãoC3 do compositor não foram editados.

ItemLista permanece usado pelo SinoNotificacoes; Chip por AgendaTarefas, FunilCliente, PainelOportunidade e NumerosPainel. Seus arquivos/testes/exceções de seleção permanecem. contarNaoLidas em consultas-inbox.ts continua sendo a soma compartilhada sob escopo, validada historicamente em linha-comercial.int.test.ts; não foi substituída por contarConversasNaoLidas pessoal311 ou agregados de conversas310. Esse testeDB não foi executado peloDEV nesta janela.

## Tipografia e trava

Os quatro alvos aprovados receberam somente classes de tipografia:

| Alvo | Resultado |
|---|---|
| ChipsFiltro: total de cada filtro rápido | font-mono + tabular-nums |
| ColunaConversas: badge de filtros aplicados | mantém mono e ganha tabular; não é contador do sino |
| PainelContato: contagem opcional de aba | mantém mono/tom e ganha tabular; E1 continua sóDetalhes |
| SeloNaoLidasInbox: pílula pessoal | mono + tabular, preservando99+/plural/zero; variante ponto não é contador e permanece intacta |

Os testes SSR verificam o span numérico real dos componentes, sem alterar produtores/quantidades ou habilitar telas futuras. ItemConversa (hora/badge) e BalaoMensagem já tinham ambos tokens e foram preservados.

inbox-e1.test.ts trava a ausência dos componentes substituídos, export antigo e cabeçalho antigo da page, mono/tabular nos alvos e sentence case local. Nenhum detector/limite/regex de guarda compartilhada foi relaxado; nenhum registro órfão existia para PainelFiltros/NotaNaThread nos mapas. Registros de AcoesAtendimento/Chip/ItemLista continuam ativos. sem-polling já tinha LEGADO vazio e incluía src/lib/eventos-inbox.ts e src/components/SeloNaoLidasInbox.tsx; foi revalidado sem edição.

## Evidência DEV

- RED eb1f6b:5arquivos/30testes,6falhas esperadas (guarda de componente/mono e quatro componentes). RenderSSR do testeColuna exibiu os avisos conhecidos de useLayoutEffect no servidor durante a falha; não houve alteração de helper global para ocultá-los. Não são prova de hidratação em browser.
- GREEN39bc8c:11arquivos/69testes de filtro/coluna/painel/selo/URL/page, saída0.
- Recorte amplo32910:89arquivos/972testes saída0. Filtros por diretório Inbox e componentes/conversa, Selo (unidade+interação), Chip, ItemLista, visual-inbox e guardas botoes/estados-vazios/fundo/campos/design/identificação/confirmações. sem-polling incluído no diretórioInbox. Sem filtro -t, nenhum skip adicionado/observado; configuração unitária padrão exclui integrações. Não é suíte global.
- Next typegen + TypeScript heap8192, executor92066: tipos gerados e terminal0; lint dirigido7e2bc1 nas15fontes alteradas/existentes incluindo nova guarda, max-warnings0, saída0; diff970b810. Node v22.23.2 verificado.

## Plano histórico dos gates coordenados (resultados finais abaixo)

ROOT coordenará global unitário/lintmáximo40, oito integrações src/server/inbox e transversais definidas no brief; um banco/suíte por vez. Só depois de truncantes o integrador restaura551registros/fixture segura e libera preview. Nenhum gate antigo de317/319 foi reatribuído a esta fonte.

CLI final preservada:20estados,100app+64protótipo=164PNG na matriz herdada, três tamanhos aplicáveis/dois temas e N/A explícito quando sem referência. Executar a matriz completa na fonte320 apósReady, com complementos320×500/limiares/foco/teclado/rolagem. Sidebar224, cortes960/1400 e todas as diferenças justificadas anteriores permanecem. Sem seleção mobile mostra lista/conversa oculta; painel500 pode exigir scroll/teclado ao último controle. Não encerrar por classes ou presumir tudo visível no primeiro quadro.

Somente evidências positivas allowlisted/hashes/fontes e pranchas inspecionadas entram no pacote final; nenhum HTML/RSC/JSONAPIbruto/negativo/log/seed/snapshot/credencial. DEV não inicia SQL/seed/servidor/integração externa/push/PR. Aprovação independente, publicação e CI são gates externos ainda pendentes.


## Gate integrado inicial e correção test-only SSE

ROOT na fonteb509: unidade49569 encerrou0 (904arquivos/7102testes), TSC65095 e lint54293 max-warnings40 encerraram0 (0erros/40avisos). Esses gates são doROOT, não execuçõesDEV. A PRIMEIRA integração80680 encerrouEXIT1:15arquivos (14pass/1fail),138testes (137pass/1fail). O caso eventos-sse.int.test.ts92 procurava a substringu9 no quadro inteiro; um ID público gerado legitimamente continha esse trecho. O formatter já removia paraUsuarioId corretamente. Não houve vazamento nem mudança produtiva para contornar o teste.

Correção mínima: somente esse casoINT usa IDs públicos fixos atendimento-u9/conversa-u9 e valida estrutura event/data/duasquebras, parseJSON dos4campos públicos exatamente preservados e ausência da propriedade privada. O arquivo UNIT existente manteve seus7casos/mocks integralmente (blob original como prefixo conferido em74e752) e recebeu1novo caso com IDs públicos contendo o mesmo trecho do destinatário. Importa formatarSSE real; dependênciasPrisma/escopo já eram mockadas, sem DB.

RED causal4e146a:8casos/7pass1fail com a asserção antiga. GREENc0fe9a:4arquivos/37testes (SSEunit8/8, rotaSSE, clienteeventos e guardainbox-e1), saída0. TSC50335 heap8192, lint2fontesbed2e5 e diff74e752 saída0, Node22.23.2. Nenhum skip ou integraçãoDEV. Em comparação com b509, os únicos deltas src deste checkpoint são os dois arquivos de teste; app/formatter/filtro/permissões/IDs reais gerados continuam byteiguais.

Na data deste checkpoint491, SSEintdirigida/15INT/global/matriz ainda aguardavamReady; os resultados finais posteriores estão na seção seguinte, mantendo fontes/executores distintos.


## Fecho DEV visual e gates coordenados — fonte491

Produção das fotos: OWN491de47c06403c96724b09701bbc20a187d1ae59, byteigual ao produtob509 e à composiçãoROOT442d1a665e82c7376ce7e8707b3a4d365257c7db (esta difere somente na integração dos testes/documentos). Fotos não são atribuídas à HEADROOT. CLI/infra herdados não foram alterados. PreviewROOT8165 em3110, Node22.23.2, perfildev-email, provedores externos vazios. FixtureA conferida b94a4d0:424hashes/551originais,9mensagens4notas.

Formal36201 TERMINAL0:20estados,100APP+64protótipo=164PNG, pasta output/inbox-320-probes/formal-r1. Todos164originais conferidos visualmente nas40pranchas. Tabela output/inbox-320-app-prototipo.json tem100linhas,64comparáveis e36N/A (6estadosfuncionais:carregando,painel-erro,thread-erro,painel-vazio,sem-selecao,busca-conversa). N/A não fabrica referência. Diferenças registradas por estado:SidebarERP224/barra móvel existentes, sóDetalhesE1, dados/capacidades/filtros/canais reais, aprovaçãoAria e negócios futuros apenas ilustrados pelo protótipo. Nenhum submit/envio/nota criado.

Limite explícito de duas fotos positivas: app-escuro-desktop-painel-erro.png prova erro do painel, mas thread independente ainda em skeleton; app-escuro-desktop-thread-erro.png prova erro da thread, mas detalhes independentes ainda em Carregando. CLI verificou o alvo correto/saída0, sem requisito de conclusão do outro setor nessas fotos. Não provam estabilidade global ou fim de toda carga da página. Nenhuma espera foi relaxada.

Complemento91340 TERMINAL0:40contextos/88PNG, pasta output/inbox-320-probes/complemento-r2, todos inspecionados em11pranchas. Dois temas:1440×900,18larguras×500 (320,390,699,700,767,768,959,960,1024,1099,1100,1199,1200,1279,1280,1399,1400,1440), mais320×500 com erro de painel controlado por transporte no endpoint exato. Abas por setas, buscaCtrlF/Escape, MenuHome/End/Escape/rolagem interna/resize, retorno do painel ao gatilho, uma instância de painel e identidade scroller/VList na mesma conversa foram verificados. Após navegação sem seleção mobile, lista e chips reais visíveis. Nenhuma falha React/HTTPinesperado/externa/submit; SSEmáxima1/ativa1,2construídas sequencialmente por contexto, sem alegar1construída total.

| Métrica real em1440×900, ambos temas | Valor |
|---|---|
| Sidebar / lista / painel |224 /372 /348px|
| Header / busca da lista / chips |68 /38 /28px|
| Padding item, vertical/horizontal |11 /10px|
| Maior balão nesta fixture |307,125px, abaixo do teto560; não prova todas as mensagens possíveis|
| Textarea / documento / scrollY |44px de altura /900px /0|

A busca NA CONVERSA mantém sua altura acessível316 e não foi confundida com os38px da busca DA LISTA. Cortes reais:uma vista abaixo960, lista300 em960..1099 e372 a partir1100; painel em coluna automático só1400. Bordas medidas sem alterar shell ou regra global.

Em320×500, ambos temas, textarea x172/y442/w80/h44/bottom486 está integralmente dentro dos ancestrais/viewport. Placeholder quebra dentro dos80px:clientHeight42/scrollHeight102/overflowYauto, sem corte do rodapé. Rascunho local breve mostrou scroll nativo até início/fim viaCtrlHome/End (scrollHeight142), sem enviar; Tab real alcançouResponder,Anexar,Agendar,Emojis,campo,Enviar e controles íntegros. Documento500/500/scrollY0. Campo estreito é limite visual registrado;44px é altura/alvo, não largura mínima do editor. No erro de painel320×500, frame inicial preservado antes de rolar; Tab alcançaTentar de novo e rola localmente, frame após acesso separado, sem clicar retry/opt-out. Não se alega cabimento inicial de todos os campos.

Tipografia sem vacuidade:em1440há5spans de chips visíveis,1pílula pessoal visível e1badge de filtro realComercial aplicado pelos controles; fontFamilymono/monospace e fontVariantNumerictabular-nums computados nos dois temas. BadgeColuna=quantidade de filtros aplicados, não sino. Mobile mede chips visíveis na lista sem seleção; pílula daSidebar oculta não vira prova visual. Ponto real8px tem texto vazio/background próprio e fontVariantNumericnormal, sem virar contador. AbaDetalhesE1tem0spansdecontagem:N/Avisual, coberta pelo SSR PainelContato.test.ts (aba opcional isolada); não se habilitou aba futura. SeloNaoLidasInbox.test.ts prova pílula/99+/zero/ponto, preservando testes existentes.

Rodada privada32366/complemento-r1 TERMINAL1 preservada INTEIRA e excluída das allowlists:probe leu padding do botão interno errado e continuou a sequência sem reabrir a conversa após filtro real limpar seleção. Só seletores/fluxo do probe privado foram corrigidos na repetição91340; nenhuma fonte de produto/CLI mudou para passar. Rascunhos locais/frames parciais/diagnósticos não foram reciclados como positivos dessa rodada.

GatesROOT da composição442d, informados pelo integrador (não executados peloDEV491):unidade69820 TERMINAL0,904arquivos/7103testes,286,57s,maxWorkers2,sem-t/skipsnovos,configunitexcluiINT; TSC5809 heap8192 TERMINAL0; lint89210 TERMINAL0,0erros/40avisos/max40; SSEint5423 TERMINAL0/11;15INT78114 TERMINAL0,15arquivos/138testes,546,02s,maxWorkers1,sem-t/skipsnovos,bancoROOTisolado. O primeiroINT80680EXIT1/137pass1fail permanece no histórico acima; correção test-only491 não alterou formatter/permissões. TESTER4914arquivos/37 e QAestático32012/161+3/24 favoráveis informados peloROOT; prova independente320×500 confirmou campo/controles íntegros sem submissão.

PacoteDEV positivo:252originais/23.322.166bytes, hashes/bytes/fontes por arquivo em output/inbox-320-formal-allowlist.json (164) e output/inbox-320-complemento-allowlist.json (88). Pranchas51derivadas ficam separadas, índice output/inbox-320-inspecao.json; métricas sanitizadas output/inbox-320-metricas.json. SemPNG,HTML,APIbruta,logs,credenciais,seed,snapshot ou scripts privados emGit. Probes/negativos locais preservados, fora do pacote.

Todos browsers/contextos fechados; ROOT parou8165/CtrlCexit1esperado (465168), exigiu porta3110livre e restaurouA defae5 TERMINAL0/424hashes551originais. Apenas blocoNext10linhas deAGENTS conferido/removido; instruções reais preservadas. Commit final sódocs/SPEC/quadro/allowlists/tabela/métricas/índice; runtime491 permanece igual. Publicação/zip remoto/CI/aceite final continuam com integrador; nenhuma próxima feature iniciada.

Validador curado18156c saiu0:252originais/51pranchas/100linhas/40contextos, hashes/tamanhos/fontes e invariância src/scripts/AGENTS conferidos; diffcheck0. Não houve repetição global por este commit documental.
