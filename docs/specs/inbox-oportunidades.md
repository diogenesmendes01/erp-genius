# Inbox #327 — Oportunidades: validação retomada

Status atual: porteR2 sobrePR420+Main composto e gates947/7742UNIT,67INT,TSC/lint aprovados na fonte9a8ebc81;QA/publicação/CI/final ROOT pendentes. Corpus18 permanece histórico APP EBF com qualificações individuais;328UI continua pendente. Registros abaixo são históricos nominais e preservam negativos.

## Consulta

carregarOportunidadesPainel(u,atendimentoId,db?) entrega OportunidadesPainel com atual|null,outras[],pessoaId|null. Verifica escopoAtendimentos e podeVerLeadNaThread na mesma Db. Lead autorizado sem Pessoa continua atual; não usa Pessoa do Contato como fallback. Fora do atendimento retorna null; ausência legítima/setor não comercial/lead negado retorna DTO vazio. Grupos não expõem CRM.

Atual projeta título/produto/valor decimal serializado/moeda do próprio país/etapa/temperatura/responsável/dataExperimentalISO/confirmação/professor/motivoPerda. Não inventa moeda/valor/score/probabilidade. Outras exigem escopoComercialAtual independente, mesma Pessoa principal, excluem atual, ordem criadoEmDESC/idDESC e take10. ConviteA não libera outras oportunidades da Pessoa. Consulta não usa helper/locks de mutação.

## Movimento e perda

moverEtapaNoInbox(atendimentoId,etapa,oportunidadeIdEsperada) exige terceiro argumento CAS. O alvo vem exclusivamente do atendimento autorizado no servidor; ID esperado só compara, nunca escolhe WHERE. z.nativeEnum valida etapa. Tx única pelo helper contexto-oportunidade: Atendimento→Lead, ator/escopo/CAS frescos após locks, moverEtapaTx real e aviso só se etapa mudou. No-op sem Evento/aviso; rollback após aviso não publicaNOTIFY. NúcleoCRM/ordem compartilhados preservados. Ações especiais não são movimentos diretos.

PERDIDO na barra usa o ModalPerda existente com acao=marcarPerdidoNoInbox(atendimentoId,input,CAS), produtor mínimo328 funcional. Não chama ação global do Funil no Inbox nem router.refresh. MATRICULADO/PERDIDO conservam recusas do Funil. Cartão experimental, Assumir e seção adicional de ações328 continuam PENDENTES.

## Apresentação e composição

Somente COMERCIAL tem Detalhes/Oportunidades. O cartão325 navega internamente para Oportunidades; os demais setores mantêm Detalhes/E1. Barra tem oito segmentos visuais4px/raio2/gap3 com alvos de botão e select das dez etapas reais. NO_SHOW destaca realizada/perigo; PERDIDO limpa progresso/neutro. Recusa de segmento mostra motivo; opções recusadas ficam disabled/title. Sem moverEtapa, controles readonly. Mensagens de ações do Funil usam alçada global independente.

podeAbrirFunil é prop booleana opcional/defaultfalse, calculada no page.tsx servidor por capacidadesCrm(usuario.papeis).has(funil.ver). Não muda CapPainel/DTO, não copia matriz e não importa sessão/infra no cliente. Links usam só a oportunidade já autorizada pelo DTO; o destino global mantém autorização própria.

Detalhes325 e editor326 compartilham a MESMA instância de useAbaPainel, ativa pela abaOUeditor; Oportunidades tem outra chave/aba sob demanda. Sem polling/SSE paralelo. Cabeçalho325/rótuloLATAM/hrefs336/C5 preservados. Loader/erro/retry não representam vazio legítimo. Modal de perda captura ID/nome/sessão ao abrir; nova seleção/op conhecida encerra sessão, loading não troca rascunho e ACK antigo não fecha uma nova sessão. Painel deixa a propriedade modal enquanto editor/perda está aberto; efeito existente de retorno de foco cobre ambos, sem mudar Modal/Drawer/useDialogo.

## Evidência nominal e pendências do checkpoint b607

- Consulta:32989/a15d1f EXIT0,10INT completos.
- Fundação refatorada327/328:78021/49ae21 EXIT0,4arquivos35INT completos,100,16s; nominal à fundação, não gate agregado327 final.
- Próprios327:69964/b5f736 EXIT1,3arquivos32INT/31pass1falha na fronteira NextAuth concorrente. O mock de sessão foi reparado preservando carregarUsuarioFresco/ACL/DB reais;6f797e EXIT0 validou somente1caso/20filtrados. No checkpoint ainda não havia execução completa32verde após esse reparo; foi a primeira pendência obrigatória da retomada.
- Unitário do checkpoint:2689/4d59b4 EXIT0,86arquivos1025testes,28,19s,maxWorkers2,sem filtro de nome/skips. Recorte Funil/Inbox/servidorunitário/guardas/Campo/diálogo, não global; src/app/api/inbox não foi incluído explicitamente nesse filtro.
- TSC24914/991786 EXIT0/noEmit/incrementalfalse/heap8192, antes de dois ajustes finais apenas de fixtures/expectativas. Nenhuma fonte de produto mudou depois; não iniciou outroTSC após liberação do client ao ROOT.
- Lint20arquivos2a2668 +doisfixtures349927 EXIT0; Botões/Campo registrados exatamente, sem exceção ou mudança de guarda.

Na pausa faltavam agregadoINT327 verde após reparo e regressões integradas finais na base coordenada, QA independente, harness/fixture/preview/capturas/aceitevisual327 e publicação. Harness/visual permanece B325; não foi tocado nesta frente. Sem browser/Save/nativa/envio/nota/instalação/Prisma/schema/DDL490. LeaseA liberada; nenhum novoDB327 após a mudança de prioridade. Retomar só com GO/base/client/lease coordenados pelo ROOT. Não marcar327 ou328 concluídas.
## Gates atuais da retomada — 24/10/2026

Fonte executável b6074f69 preservada, sem alterações de produto/testes. Após READY487 ROOT60384/a6164e/NextE246/restauro1fe1e8/424hashes, agregado próprio59550/11a8f5 terminou EXIT0: três arquivos completos/32 testes,138,24s, config integration/maxWorkers1, sem filtro de nome/skips. O caso concorrente reparado passou junto dos demais; a lacuna31pass/1falha do checkpoint fica resolvida por esta execução atual, mantendo o negativo histórico.

UNIT87637/983c28 EXIT0:97 arquivos/1.188 testes,44,86s/maxWorkers2, incluindo explicitamente src/app/api/inbox. TSC44881/53811c EXIT0/noEmit/incrementalfalse/heap8192; lint25 TS/TSX5a8c99 EXIT0/maxWarnings0. Fonte congelada até terminais; nenhum novo testeDB após esse agregado. Clients/listeners fechados e lease dev-email liberada ao ROOT; não presumir restauro seguinte.

Report output/inbox-327-retomada-gates.md e manifesto fontes-gates.json registram inventários/hashes/fontes/comandos/limites. Blueprint privado DMMF487 possui dez registros novos propostos, sem SQL/aplicação/preview. QA exata, composição/regressão final, handoff harnessB325, fixture/preview/formal12/complementos e publicação continuam pendentes. Produtor mínimo328 não encerra328UI/visual. Nenhuma captura ou homologação anterior é reatribuída à327.

## Correção de owner da perda — 24/10/2026

Uma identidade conhecida diferente no DTO Oportunidades encerra a sessão local de perda: aberta=false, id/nome limpos. Loading ainda desconhecido preserva a sessão/rascunho da mesma oportunidade. Assimop1→op2 conhecido→loading e retornoop1 não reabrem o modal antigo sem clique; ausência conhecida também encerra. Nova aberturaop2 e ACK antigoop1 continuam isolados. Fix exclusivoInboxNovo, sem mudar ModalPerda/Drawer/useDialogo/backend.

RED88b89f duas falhas causais preservado; iteração5dc6a6 negativa de oráculo do ownerPainelContato registrada. GREEN417852 foco20/20; UNIT37553/81176d97arquivos1.192testes35,61s, TSC39002/51c3eb e lint2/21d383 terminais0. Sem filtro de nome/skips ou novaINT/DB;32INT anteriores são nominais ao backend inalterado. Report output/inbox-327-owner-perda-report.md identifica fontes/negativos/limites. QA exata e visual/fixture/preview continuam pendentes; o DOM mínimo não é prova nativa.

## Módulo isolado de prontidão visual — 24/10/2026

Preparados somente scripts/visual/oportunidades-inbox.mjs, tipos .d.mts e src/test/visual-inbox-oportunidades.test.ts. Configuração exige IDs/ator explícitos da fixture327, sem senha/fallback canônico. Preflight preparado verifica sessão + Painel + Oportunidades, contexto/capacidades/PROPOSTA1234.56BRL; três GETs de preflight ficam separados de aquisiçõesUI:null. Nome vem de Painel.acoes.contatoNome e subtítulo de Painel.cabecalho.subtitulo, sem reconstruir precedência ou confundir Pessoa/op. Abertura APP só navega/hidrata/abre painel e aba; referência mantém o HTML originalc1/720/Aula experimental/seis segmentos, sem alterar dados/etapa/CSS. Leitor é APP-only porque o protótipo não representa D13.

Callback DOM autocontido exige conteúdo/estado/identidade visual, oito segmentos/dez opções APP, rótulos/campos/controles e progresso/CSS finitos; recusa casca/loading/erro/fora da tela/inert/overflow/modal concorrente. TDD tem58 casos próprios, incluindo RED causal de gapNaN/progresso3ce32a e cabeçalho443aea. GREEN554ecb58/58; regressão final0fea71 EXIT0,16 arquivos/162 testes/2,84s/maxWorkers2; TSC23954/3a386c e lint3/57a594 terminaram0. Sem filtro de nome/skips; UNIT com doubles/DOM mínimo/VM, não browser/HTTP real. Negativos intermediários e limites em output/inbox-327-harness-modulo-report.md.

Produto6b2f preservado; AGENTS contém apenas10 linhas Next geradas e fica fora do commit. CLI/matriz, cancelamentos de Oportunidades e coletor continuam B325 até handoff; não foram alterados. Nenhuma requisição nova, browser, captura, movimento ou Save nesta preparação. Registro de estado/CLI, QA exata do módulo, preflight real, medição de aquisições UI e formal12/complementos continuam pendentes. Módulo parcial não é aceite visual e não encerra327/328.

## Composição do harness após handoff325 — 24/10/2026

Porte separado0b000725 aplica somente18 paths de scripts/visual e testes desde B0558→d775, após precheck de OIDs/gitapply--check; contatos-mobile já idêntico foi excluído. Curadoria336/README da base e três próprios327 preservados. Nenhum SRCAPP/schema/deps/documento325 foi transportado. Dezessete arquivos/150 testes e seis módulos núcleo/Detalhes/coletor325 permanecem literalmente iguais d775; a CLI recebe extensão independente327.

Núcleo-base permanece220. Registro/planejador/combinador efetivamente usados pela CLI expõem238 únicos, preservando subconjuntos220/190 byteiguais com hashes independentes;18 novos=12 adminAPP+PROTO e6 leitorAPP. Não é contagem de capturas realizadas. Preflight agora tem quatro GETs (sessão/Painel/Oportunidades/Detalhes), separados das aquisiçõesUI reais, cujo contador só é liberado pela auditoria final.

Coletor327 próprio exige START/deferred até corpo/hash, drain dinâmico, identidade completa, token/selo/DOM e auditoria após fechamento de contexto/browser. Primeira fase aguarda Detalhes completo antes do clique explícito em Oportunidades; Detalhes tardio não é descartado. Segunda fase exige corpo/hash/DOM Oportunidades. Aborto só recupera por START posterior inteiro200/hash esperado na mesma identidade; último request pendente/falho, HTTP diferente, body divergente e eventos tardios reprovam. Guardas953 continuam sobre todos18, inclusive abortos genéricos após close, sem mexer no classificador/150 provas325.

PROTO mantém originais e hashes nominais. A exceção aprovada do TypeError console `sel` exige ambos os hashes e callsites exatos, sóPROTO/consoleerror. Pageerror/APP continuam falha. Bruto privado exclusivo, curado com contagem/limite; painel estático não demonstra autoscroll/foco/seleção. Novos casos não alteram DOM/CSS/dados para equivalência.

Gates da composição: UNIT20dafd EXIT0,21 arquivos completos/266 testes4,10s/maxWorkers2; TSC37106/ad22d2 EXIT0/noEmit/incrementalfalse; lint10 paths2b6ac6 EXIT0/maxWarnings0. Testes próprios116=71módulo+27coletor+4registro+14CLI, mais150 herdados byteiguais. Sem filtro por nome/skips, sem DB/HTTP/browser/PNG real. Relatório output/inbox-327-harness-composicao-report.md e manifesto fontes.json preservam negativos/limites. APP6b2f intacto; AGENTS10 linhasNext fora do commit. Formal/QA/GO e patch325 de cache useAbaPainel ainda pendentes; não homologar327 nem encerrar328UI.

## Porte R1 de cache e freeze integrado327 — 24/10/2026

Portados somente os quatro SRC do delta29b→fd1ea de325: hook/teste exatos e testes Detalhes compostos com duas abas327; InboxNovo muda exatamente uma condição de fallbackWhatsApp, preservando Perda/ACK/rascunho/aoAbrirOportunidades e DetalhesOUeditor. Cache guarda o último DTO bom por atendimento/aba/ativação durante versão/retry/erro transitório; respostas obsoletas não substituem a vigente e403/404 revogam o snapshot. Pessoa:null pode conservar telefone já autorizado, sem inventar perfil.

GuardaHTMLinput.type08852 portada sem docsB/classificador alterado. Única exceção técnica aprovada para etapas-painel.ts/ternário atual: tokensCSS tipados marca/perigo/neutro em spanaria-hidden; rótulos seguemETAPA_LABEL. Dez etapas/80segmentos/aria/title/opções estão cobertos; produtor permanece6b. Negativo de pathPROTO agora usa suporte observado e prova raízes simuladasA/TESTER/ROOT; predicado e runtime do harness permanecemc270.

RED8c27aa7falhas/18pass→GREENf2e5be3/45; negativo14429/edbbd21falha/144pass era classificação do token técnico, não UI; guarda/oráculos11475/f2c4e84/1740. UNIT final42851/7267750:119 completos/1.621 testes63,34s/maxWorkers2, sem filtro/skips; TSC99072/3e10670 e lint8/7e7c8d0. Recorte app/fundação/harness/guarda, não global/INT. Prova25blobs6b e runtimec270 preservados no manifesto output/inbox-327-r1-fontes.json; report-r1 registra negativos/avisos/limites.

Sem novoDB/HTTP/browser/PNG, fixture/preview sobROOT e AGENTSNext fora do commit. QA exata, wrapper privado restritivo (browser e APIRequestContext separados), IDs reais das duas ações incidentais e GO formal18(6APPadmin+6PROTOadmin+6APPleitor) continuam pendentes. Não usar mainCLI como permissão de escrita nem homologar327/328.

## Prontidão visual APP em scrollport natural — 24/10/2026

Correção delimitada às duas funções APP do harness de Oportunidades: tabpanel pode ultrapassar o viewport se continuar perceptível e intersectar seu scrollport; cabeçalho/abas/cartão/controles essenciais seguem inteiros, inclusive contra clipping ancestral. Status idle vazio não equivale a loading. Busy acessível ou anúncio significativo em alert/status (texto/aria-label/aria-labelledby), inclusive sr-only ou opacity0, continuam bloqueando. Estados ocultos/inert e regiões vazias são ignorados. Nenhuma mudança em produto runtime EBF/DTO/CSS/PROTO/953/coletores/SSE/marcarTransicao.

DIAG0R2 mediu área terminando996,609375px em viewport900 e scrollHeight997, com controles essenciais visíveis; a cadeia MensagemStatus→FeedbackAcao→OptOutContato mantém role=status vazio mesmo idle. O snapshot não identificou o primeiro status correspondente nem prova causa exclusiva do timeout A5. Originais/pacotes/negativos permanecem preservados. RED cd866d/98066d, GREEN4d77a5 129/129 e recorte completo fc7d59 21arquivos/327testes/lint146d77 EXIT0; TSC final37256/3b6456 EXIT0 (8GB/incrementalfalse), após OOM padrão49060/5d980d EXIT134 e TS2352 causal4104/884bc7 no helper de teste; corrigido com Elemento real e revalidado792512 129/129/lint2bf8be0. Recorte21/327 é nominal ao módulo inalterado; só narrowing/import do teste mudou depois. Report output/inbox-327-harness-a6-report.md registra fonte/gates/limites. Produto runtime inalterado; deltaSRC somente teste. Novo HARNESS/CHECKOUT não reutiliza identidade c270. Sem nova operação nativa; QA, wrapperA6/admissão/GO separados e visual permanecem pendentes.

## Prontidão visual PROTO após diagnóstico medido — 24/10/2026

O original renderiza R$ 720; descricaoPROTO passa a exigir esse texto literal. A área SECTION358..920,234375 intersecta o scrollport342..900 e pode excedê-lo, mantendo nome/cabeçalho/título/Funil/produto/valor/select/seis barras inteiros e perceptíveis contra clipping ancestral. Busy/status/alert, etapa/opções/cores seguem rigorosos. Quatro hunks exclusivos PROTO; descrição/ramoAPP/helpers, Detalhes inicial,953/coletores/SSE, originais HTML/support/role/mobile e produto runtime EBF permanecem preservados. Produto runtime inalterado; deltaSRC somente teste. HARNESS/CHECKOUT recebem identidade nova;9480 e pacotes A7/A8/DIAG continuam históricos.

RED7falhas/139 controles registrado; GREEN7a5e2b146/146 e lint0b61ce EXIT0; TSC final sessão19536/114e95 EXIT0, Node22 --max-old-space-size=8192 --noEmit --incremental false. TSC90751 EXIT2 administrativo na cópia privada.ts preservado; classificação para.ts.snapshot mantém bytes e não muda tsconfig/testes. Report output/inbox-327-protofix-report.md e prova privada registram hashes físicos/GitLF/OIDs, quatro hunks reversíveis e limites. Sem nova operação nativa/DB;91router/composição não repetidos porque inalterados. A7/A8/DIAG negativos intactos. Nova composição6A7APPadmin+12novos depende de congruência auditada, wrapper/pins novos, QA/fresh/GO; limite badgeNext mantido. Não concluir327/328.

## Harness: leitura contextual e acesso ao Funil separados — 24/10/2026

Diagnóstico leitor mediu55true/1false/0null: o link legado Abrir oportunidade pertence ao Cadastro do contato fora da área327, vindo de acoes.leadId autorizado pelo conviteD13. O predicado anterior consultava o painel inteiro sob !podeMover, confundindo funil.mover com funil.ver. Produto/ACL/legacy335 permanecem intactos. Descrição/preflight da fixture agora declaram podeAbrirFunil separado e href atual/legado do ID previamente autorizado no MESMO DTO, sem novoGET. Links novos na área exigem alçada global e ID exato, sem exigir presença no estado inicial; fora só é permitido um link no slot legado com href/texto exatos. Slots/IDs/query/duplicatas/DTOdivergentes continuam negativos, mesmoadmin; controles disabled/lápis não ganham escrita.

RED9f269c15falhas/152passes; final4116c6 EXIT0:167/167,lint3paths257283+teste6324730,TSC72594/dff9d90(8GB/incrementalfalse). Iterações301936(oráculo semleadId do próprioDTO) e48381/ebc796(TS2339 no teste;Reflect.get real) preservadas no report output/inbox-327-harness-funil-contrato-report.md. Helpers/PROTOdescrição+else/953/coletores/SSE/runtimeAPP EBF iguais;deltaSRC sóteste,declaração aditiva do harness. NovoHARNESS/CHECKOUT e guarda futura3executáveis(module/.d.mts/teste),semreusaridentidadebe45. Cinco snapshotsbe45 preservados;109A9=105correntes+4snapshots(módulo/teste/SPEC/quadro),declaraçãoGit separada. Sem nova UI/HTTP/DB/wrapper/INT/global;reusoA7/A9 dependecongruênciaT e novaQA/fresh/GO. Não retroatribuir causa exclusiva ao A9,homologar327 ou concluir328.

## Harness: tabpanel completo e bloco327 específico — 24/10/2026

Correção da inferência anterior: PainelContato envolve TODOSchildren no tabpanel, inclusive Cadastro legado. HTML nativo7cb6 integral11174B/SHA4010b6e5... foi parseado porASTTSX(84nós/0diagnósticos):area.contains(legado)=true,header.parentElement(bloco327).contains(legado)=false. A alternância em InboxNovo não é a fronteiraDOM;167/fd2d eram nominais ao double que punha o footer fora do tabpanel. Logs/pareceres/A10EXIT1 não foram reescritos; A10 sembitmap não ganha causa exclusiva atribuída.

Somente o header já validado delimita parentElement próprio dentro do tabpanel e com select/label/grupo/camposesperados. Links novos usam esse bloco/capglobal/ID; legado é fora do bloco,no slot/DTOexatos,podendo estar dentro do tabpanel(real) ou fora dele(compatibilidade). SlotCadastro descendente do bloco ou englobando-o é recusado; todos negativos de enabled/lápis/IDs/slots/duplicatas/geometria/estado continuam. Sem produto,markerDOM novo,ACL,descrição/preflight/tipos,PROTO/helpers/953/coletores/SSE alterados.

REDae25e3 10falhas/166passes;GREEN64ad04 176/176,lint/syntax498030 eTSC82289/af8287(8GB/incrfalse)EXIT0. Provasc87603/997513/4e27be e report output/inbox-327-harness-fronteira-report.md distinguem HTML antigo,modeloestrutural e fontes. Sem nova91/global/INT/UI/HTTP/DB/wrapper/captura. Quatro snapshotsfd2d;158A10=154correntes+4snapshots,novaidentidadeHARNESS/CHECKOUT,APP EBF preservado. ReusoA7/A9 depende novaQA/congruência,sem afirmar medição nativa dos novos checks nas fotos antigas. Preview/DBRoot,AGENTSNext fora. QA/wrapper/fresh/GO e327/328 permanecem pendentes.

## Curadoria18 e handoff mínimo sobre420 — 24/10/2026

A11 executou seis APPleitores novos comEXIT0 (39668/ea44d4), seis contextos/browser fechados e auditorias core/rede/SSE pósbrowser positivas. Corpus selecionado:6APPadminA7nominal9480+6PROTOA9nominalbe45+6APPleitorA11nominalcfa; não é run18novo. A7/A9 agregados continuamEXIT1;A10/0PNG e diagnósticos ficam fora. ReusoA7 é por congruência, sem checks href/slot/fronteira retroativamente medidos;badgeNext limita parte do linkmobile. PROTO é referência estática distinta, sem prova de foco/autoscroll/seleção.

QA T A11 afd86c4a e allowlist a869150d favoráveis. UI23=17Detalhes+6Oportunidades separadas de42APIpreparatórias;290registros inclui6SSE(284nãoSSE);18POSTincidentais naturais,0Save/movimento/perda/nota/envio. SeisSSE1START/1terminal realPageviva antesContextclose,sem pendências ou settled sintético. Nenhuma nova operação durante curadoria.

ZIP sanitizado18originais+README+manifesto e PNGrepresentativa propostos, semupload; hashes completos no report output/inbox-327-entrega-curadoria-handoff.md. Manifesto output/inbox-327-fonte-handoff.json delimita paths/hunks327 sobre PR420HEAD179b, dependência real326 e fundação328mínima. Não portar história agregadaA,reversões337 ou arquivosMaininteiros. Preservar hook326ativo porabaOUeditor,hrefs336,Compositor/Sino/menções e schema/depsMain. Perda mínima é dependência técnica, não restante328UI. Integração/CI,QAcuradoria/handoff,restauroROOT e publicação permanecem etapas separadas.

## Porte R2 para Main preservado — 24/10/2026

Produto327 composto sobre74d4(PR420179b+Main170edbad) por hunks;OR420 do hook Detalhes e4defaultsMain343 preservados,sem sobrepor337/Compositor/Sino/notificacoes/whatsapp/schema/deps. Fundacao328 separada ca208d9c,restante328UI pendente. Gates desta fonte integrada aguardam freeze+UNIT/TSC e GOINTROOTA491;QA/capturas487 e corpus18 continuam nominais historicos,nao aceite da nova composicao. Nenhum browser/DB usado neste porte.

## Gates R2 finais — 24/10/2026

Fonte9a8ebc81 sobreBase74d4 preservaOR420/4defaultsMain343 e3509OIDsBase não selecionados. UNITglobal44258/56df77EXIT0:947/7742,438,64s,maxWorkers2;lint43/1bebe70;TSC5350/2c07e30,heap8192/configoriginal semaux/exclusões extras. INT84101/84d73dEXIT0:7completos/67casos,243,42s,maxWorkers1,semfiltros/skips,perfilA491 eGOspecROOT. Banco explicitamente liberado aoROOT;restauro somentehelperA491,sem presumir conclusão.

Report output/inbox-327-port-r2-report.md e manifesto output/inbox-327-port-r2-fontes.json registram45OIDs,40literais/5exceções,proteções,gates e listaINT. Nenhumruntime mudou apósfreeze,nenhumUI/browser/captura/manual/envio/DDL/install executado. Corpus18nominalEBF eZIP preservados,semupload;CLI≠wrapperA11. QAexata/CI/composição/publicação ROOT e restante328UI continuam separados.

ROOT confirmou restauroA491 posterior aos67INT (5369daEXIT0):424hashes/557registros/sequencias/snapshotfc12preservados. NenhumDB/UI retomado peloDEV. QA cfa f5bd historica eQAporte ec29 mantemfontes distintas;novoDOCnao altera runtime9a8 oucorpusEBF.


### Publicação e QA independente da composição327
Composiçãoc9016471 sobrePR420/ecac preserva43executáveis+README byteiguais9a8 e oquadro420integral. TESTERindependente aprovou17UNIT/460(aaa8b4) e7INTcompletos/67(f90840,263,04s,w1),semfiltros/skips. RootrestaurouTESTER491em7dd18aEXIT0:424hashes/1392registros/sequências/9mensagens4notas;A4915369da557registros. [QA e limites](../../output/inbox-327-qa/indice.json). Corpus18históricoEBF permanece qualificado,sem nova captura;ZIP/PNGaguardamautorização/publicação. Dependência326,CI/full/revisãofinal/merge327pendentes;328UIparcialaberta.


## Revisão R1: portabilidade dos originais e cabeçalho opcional

O finding B1 é real: os pinos físicos CRLF do Windows recusavam os blobs LF no Linux. As conversões completas nos dois sentidos provaram que só os finais de linha diferem. A guarda anterior ao browser e a exceção estrita de console passam a admitir somente os hashes raw exatos das duas representações conhecidas, sem normalizar o arquivo servido ou editar os originais. O manifesto conserva o hash físico real; o corpus anterior continua nominal às fontes físicas originais. Não houve recaptura nem execução de browser real nesta correção.

C3: sem cabeçalho, a aba recebe todas as capacidades negadas. As regressões ausente/nulo falharam antes da correção e o controle positivo preserva as capacidades recebidas. B1 GREEN2arquivos/24 e C3 GREEN3arquivos/132, sem filtros/skips, são recortes diferentes e não são somados. Lint5 EXIT0; TypeScript original9539/74fac3 EXIT0, Node22heap8192/noEmit/incrementalfalse, semconfigaux/exclusões extras; QA final ainda pendente. Prova em output/inbox-327-qa/revisao-r1.json.

Integração completa668 em output/inbox-327-qa/ci-full-668.json:357arquivos/3.185testes aprovados, três arquivos/quatro opt-in ignorados, quatro shards. Essa execução antecede o patchR1 e não é uma nova integração dele. Backend/schema/contratos de transação não foram alterados pelo patch. A prova composicao.json de44objetos permanece nominal ao porte anterior; os cinco deltasR1 têm hashes separados. Dependência326, autorização/publicação de anexos, composição com main e merge continuam pendentes.
