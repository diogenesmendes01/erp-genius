# #316 — checkpoint DEV A

Branch codex/inbox-e1-316 criada de5dc9ec5aea6ad1ae34071bd268e075a5c07c56f9,315imutável. Plano/ruling aprovadosROOT: busca local somente mensagens carregadas até600, nenhuma consulta/endpoint/leitura extra; foco retorna Buscar desktop/Maisações mobile, atalho anteriorválido+fallback; pinKeys e geometria local, sem editar motorVirtualList/helperdialogo.

Implementação: busca-conversa.ts normalizaNFD/marcasUnicode/case/espaços, exige2caracteres normalizados e ignoraapagada/corponulo, retornaIDs cronológicos semmutarentrada. BuscaConversa barra flexível abaixoheader68,contagem/navegação circular, Enter/ShiftEnter/Escape inclusive controles,estadoocupado e aviso nas2bordas. Header/menu315 busca habilitada sem ampliar corte700.

useBuscaConversa mantém achado porID e reconcilia SSE/paginação/remoção; trocaA→B→A limpa estado por ajuste guardado durante render, sem efeito corretivo/intervalo/remountthread. Listener keydown da sectionConversa física comcleanup, exige foco dentro/regiãovisível/nãoconsumido/semAlt oucomposição/modal. Foco do campo porlayout; repetiratalho não sobrescreve retorno. DOMhelper limita seleção por atributo comparado (ID inseguro não é CSS), pinmonta row antes derolar; scrollTop calculado porgeometriareal com umframe de reconciliação cancelável. Não há polling/scrollIntoView/documentscroll.

ConversaAberta compartilha uma composição decorarThread(itensDaThread(msgs,notas,temMaisAntes,temMaisDepois)) comVirtualListstableMount; pin atual e destacada somente balaomensagem, semnotas/dias/evento buscáveis. Preserva384/R6/SSR312/314/388,compositor,autores,menus eidentidade daVirtualList. Nenhuma ediçãoInboxNovo/backend/produtor/eventosVList/sharedhelper.

TDD observado Node22.23.2: RED510a25 móduloshelpers/barraausentes→GREEN2files7; REDa49132hook/DOMausentes→GREEN5; RED0030f0 ligaçãoheader/menu/destaque/pin3falhas→GREEN3files10; RED0c0c44Escapecontroles/repetiçãoatalho→GREEN; REDc282d0trocaA→B→A→GREEN4testes. ProvaSSRrealVList com150msgs/notas/dias: achadoforaDOM aparece ao receberpin; testeestado real usaReactDOM+fixtureJSX/dommínimo, geometria/atalho emtestesdiretos comlimites explícitos.

Recorte inicial16334 EXIT1:66files731tests/729passes, apenasregistrosdesign. Registroherdado315header separado em31fd5cd49952607982d5fec15d84cf8093e17582 (guardafundo+ledger,semSearch316). 315nãoexecutou essa guarda no106/1058,nemownfullverde. ROOT autorizou entradasexatas316 botãoCarregaranterioresfantasma/sm+inputbg-surface-muteddentrobarra, semalgoritmos/limites/exceçãogenérica.

Gates checkpoint: sessão32180 EXIT0,67arquivos734testes,28.72s,maxWorkers2; recorteInbox+conversa+Menu/Botao+botões/campos/fundo/confirmações/responsivo/identificação,semfiltrodenome/skips,DBexcluídopelaconfig. TSC80835heap8192 EXIT0. Lint18fontes/testes/guardas0avisos EXIT0 f18f63; diffcheck0. TSC6755/54ad4a históricos EXIT1 por contrato ocupado/casts de fixture, corrigidos; lintrefstestestruturadoemfixtureJSX semdisable e semnovadependência. Últimoajuste estritamente atalhotrue receberá recortehook/lint dirigido antescommit.

Pendentes: browser coordenado3tamanhos2temas/320×500/nomeextenso e larguraútil3colunas; teclado dentro/fora/modal, pin foraDOM>100+notas/dias/99→101+foco/scrollclientreal. A medição DOMmínima/SSR não substitui navegador. DeltaCLI app-onlybusca-conversa ainda não iniciado, preservar guardReact/hidratação/anonDOM392 e manifestosemreferênciafuncionalprotótipo. TESTER/globalintegrado/publicaçãoROOT pendentes. Nenhum DB/preview/install/package/schema/envio/PR/push;315refpreservada.

Ajuste final origematalho===true: execução d320c4 EXIT0,2files9testes; lint hook0avisos EXIT0. Nenhuma alteração de tipos/estrutura apósTSC80835; sem global próprio.

## Freeze do harness316 antes de imagem

RED97f9df:6falhas nos estados/exports/prontidão anteriores; GREEN7a9a5a:6files44tests EXIT0. CLI total124PNG(66app58proto),busca-conversa APP-only6 com motivoSemReferencia e referenciaFuncionalPrototipo:null. Termomatricular aprovadoROOT por existir no corpo Beatriz; desconto do exemplo não existe e notas não entram. Preserva estados315/318/314/313; menu-mais passa a exigir busca habilitada, bloqueio continua indisponível comrazão. Helpers de abertura/prontidão aguardam thread/hidratação/campoativo/destaque/contador/header68; fonteApp/hash4módulos+anonDOM392/React404/rede preservados. TSC12205heap8192 EXIT0 e lint7fontes0avisos EXIT0 apósdeltaCLI. Produto1415 byteinalterado; sem captura antes destefreeze. PreviewROOT94445 é do integrador, banco normal preservado; próxima etapa probes normais coordenados,semDBwrite.

## Browser normal na fonte1415 / harness23c

26040 EXIT0:16contextos32PNG,1440×900/1024×768/390×844/320×500/390×500/699×500/700×500/1400×500,2temas. Header68,documentY0/semoverflow,achado dentroThread/foco campo,Enter/ShiftEnter/ciclo/botões/Escape/focoDesktopMobile/atalho/resize/termo1char. GETmensagens2→2 emtodos casos durantebusca(semquerynova).63491 EXIT0:4contextos8PNG modalNota semsubmit/CtrlFmodal nãoconsumido/Escape sómodal, MetaFlistafora/oculta nãoconsumido,Beatriz→Mariana→Beatriz semestadoanterior.0React/externos.52086 EXIT0:formalapp-only6PNG,3sizes2themes,source1415/hashes4harness23c/referênciafuncionalnull explícita.

Todas46capturas inspecionadas(6originais+40em20pranchas),hashesconferidos; allowlistpositiva-normal.json seleciona72arquivos/66PNG(20pranchas),semPNGnoGit. 320×500 permitequebraFechar emsegundalinha paraalvo44; header68preservado eThread/compositor continuam úteis. Estadoapoio normal307/314 semseedalterado;previewROOT94445/banco emcoordenação,todosbrowsersfechados apósprovas. Prova>100/paginação/SSE,TESTER/global integrado continuam pendentes.
