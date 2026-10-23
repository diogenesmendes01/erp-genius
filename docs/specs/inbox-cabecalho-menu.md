# Cabeçalho e menu da conversa — #315

Contrato: cabeçalho68px, identidade truncada, status automático do ERP (D7), Buscar indisponível até316 com motivo acessível, Transferir/Assumir pelas capacidades atuais, Painel único318 e menu de comandos. Não lida é preferência pessoal pelo servidor existente (D16); Bloquear permanece desabilitado com AVISO_RECURSO_MOTOR (D15).

Recorte: CabecalhoConversa/MenuConversa, controlador e useAcoesAtendimento preservando contexto original, diálogos, ocupado, chaves idempotentes e fuso; Menu opt-in compacto/folha e Botao neutro; estadoVisualCabecalho tipo puro6campos. ConversaAberta recebe somente a nova composição do header, preservando thread314 e ciclo318; InboxNovo apenas props/JSX.

Cortes vigentes: Voltar abaixo960, avatar/busca ocultos abaixo700, textos de ações a1200, painel automático1400. Diverge dos cortes700/1200 do pseudocódigo para preservar uma vista308 e Sidebar224. Botao mantém alvo móvel44.

Menu padrão não muda. Opt-ins: compacto290px, itens mínimo38 crescendo com dicas; folha abaixo700, max85dvh, coordenadas desktop por CSS sem top inline impedindo bottom móvel. Navegação pula disabled, dicas/separadores não focáveis, Escape filho não fecha pai, rolagem interna não fecha, externa/resize fecham.

Entrega ainda em desenvolvimento. Evidência automática, visual, QA e limites em output/inbox-315-report.md.

Implementação parcial315: controlador key=item.id chama hook incondicional; grupo/encerrado preservam somente preferências e busca indisponível. A fábrica usa capacidades AcaoInbox (notaInterna; pendentes=convidar||agendar), bloqueio disabled e razão completa. Busca segue disabled inclusive teclado. Recontagem pessoal311 consumida uma vez só após marcarNaoLida.ok, sem alterar produtor/eventos/leitura e sem polling. Feedback ausente não ocupa faixa; erros/sucessos não truncados.

Menu compacto também limita altura a calc(100dvh - 16px) e rola em desktop baixo; abaixo700 a folha prevalece com max85dvh/bottom0/top-auto. Default conserva classes/markup/posicionamento/listeners e keyindice; nenhum algoritmo/exceção de guarda alterado. Botao neutro é aditivo. Status permanece no header móvel em coluna quando pouco espaço, sujeito à medição real.

Gates DEV Node22: composição d31 52/616,TSC/lint0;315 recorte100arquivos1000testes sessão4398 exit0;TSC59023heap8192 e lint16fontes0avisos exit0. Após limite de altura opt-in:4arquivos99testes exit0, sem ignorados/filtro de nome. Visual320x500/699700/9601400/3sizes2temas, foco/rolagem, CLI315, TESTER e global integrado continuam pendentes; isso não é homologação.

Ruling largura útil após browserRED: Thiago na fila comTransferir+Assumir deixou nome0px em1400/1440 (header456/496). Container local só emidentidade/ações, Menu fora para preservarpositionfixedviewport. Textofull exige viewport1200 E container576 (headeraprox640); Assumircurto exige viewport700 E container432 (headeraprox496); abaixo ícones comnomes/títulos. Nenhuma mudança deSidebar/shell/capacidades. Negativo fila-r1 preservado; TDD RED1/5→GREEN3arquivos118testes0; lint2fontes0avisos exit0; TSC31874 exit2 devido às2declarações ausentes de novos exports do harness, sem erro emprodução. Anotação anterior de TSC0 estava incorreta e foi corrigida. Repetição real antesaceite pendente.

Probes f7 antescomposição:61261 exit0,20contextos60PNG (larguras320/390/699/700/959/960/1024/1399/1400/1440×500,2temas);35720 exit0,14casos14PNG da fila canônica (320/390/1399padrão,1400/1440painelaberto+fechado×temas). Header68 efolha425/bottom500 mobile, menu484/top8 desktopbaixo; Home/Endrevelam, disabledskip, Escape/foco/resize/Nota semsubmit/painelúnico/retornogatilho verdes. Nomes dafila56/102mobile,102 em1400e87 em1440; painelfechado expande804/844 e textosfullcabem. Inspecionadas todas74capturas em27pranchas positivas. Allowlist105arquivossemPNGnoGit emoutput/inbox-315-probes/allowlist-positiva-pre-composicao.json; negativosnormal-r1(syntheticWindow),normal-r3(ACCNAMEprobe incorreto),fila-r1(produtoRED) e histórico/duplicadospreservadoslocal,excluídos.

Harness315apóscodefreeze: TDD4RED→5arquivos40testes0;total118PNG(60app58proto),menu-mais+12,preservando313314318,Reactguard,hidratação,anonDOM392 ehashes4módulos. d.mts dos2exportscorrigidas apósTSC31874exit2; TSC60344heap8192EXIT0 confirmado. Preview84576encerradoROOT, blocoNext10linhasconferido/restaurado. Nome97/finalformal/composição313automática388/TESTER/global integradopendentes.

## Composição atual313automática/388 — 23/10

Merge normal4fcdc6cad73c3ad8782405c29db8770122fa8432 em8b3c46ac475b8e881691b49a0d8139707771236d. Único conflitoquadro, preservadosamboshistóricos. InboxNovo difere daROOT somente na composição318; nenhum hookdeconsulta/leitura/URL/SSE editado pela315. ConversaAberta preservaheader/controller315 e retiradaduplicatatriagem318, VirtualListstableMount/decoração314, callerreal itensDaThread(...,temMaisAntes,temMaisDepois) de388 incorporado sem adaptaçãofalsa. Módulos315 Cabecalho/MenuConversa/Acoes/Menu/Botao byteiguaisf7.

Gates exatos8b Node22.23.2: recorte106arquivos1058testes sessão47282 exit0 (Inbox+componentes+guardas+retornodiálogo+leituraautomática+5harness;semfiltrosdenome/skips;integraçãoDBexcluídapelaconfiguração);TSC50243heap8192 exit0;lint24fontes0avisos exit0;gitdiffcheck0. Nenhuma suíteglobalprópria. Fonteproduto congelada8b; próximosartefatosdocumentaisnãoalteramruntime.

Provasprivadasf7 continuam identificadas comoanteriores à composição; não são homologaçãoda8b. Próximo: previewcoordenado, formal44PNGs conversa/humano-compositor/menu-mais/celular-conversa/tablet-painel nosdoistemas, nomeslongos97 apósformalnormal, revisãoTESTER/globalintegrado peloROOT. Banco/fixturecanônicos preservados; não há processobrowser/DEVativo nemenvio de negócio.

## Provas atuais e fechamento DEV — 23/10/2026

Fonte visual efeb0e1f259bb295e4cfb39789c30807820ce337, runtime8b3c46ac475b8e881691b49a0d8139707771236d. Formal3772 EXIT0:44PNG (22app/22protótipo), conversa/humano-compositor/menu-mais nos3tamanhos e2temas, celular-conversa/tablet-painel nos2temas. Todas inspecionadas em22pranchas. Manifestos registram alguns GET cancelados e recuperados; nenhuma falha fatal/React/externos.

Complemento longo12809 EXIT0:8contextos/24PNG,320/390/1400/1440×500×2temas, nome97 comtitle completo/ellipsis e15tags confirmadas antesmedição. Header68,controles dentro, motivo de bloqueio integral e último controle do painel alcançável por rolagem.24fotos inspecionadas em8pranchas e desktop original. Tentativa38148 EXIT1 preservada local, pois probe mediu tags antesGET; correção somente na prontidão do probe, nenhum patch deproduto. Não se clicou em Registraropt-out ou outra ação de negócio.

Allowlist positiva atual em output/inbox-315-probes/allowlist-positiva-final.json:44formais+24longas+30pranchas, metadados e2probes/copier selecionados individualmente comSHA256; 107arquivos/14040081bytes. PNGs permanecem locais, não versionados. Hashes das68capturas conferidos; helperDOM392v1 em ambos alvos apósinteração/antesfoto. Negativos/HTMLbruto/logs/refsantigas excluídos. Provasf7 anteriores mantêm allowlist separada.

Preview71311 encerrado peloROOT; snapshotA restaurado0fcd3b EXIT0,424tabelas comhashes originais; banco307/314 normal, sem browsers/servidorDEV. Conferidas/restauradas só10linhasNextAGENTS. Diferenças intencionais contra protótipo: D7ERP automático,D15bloqueio indisponível,D16preferência pessoal,Sidebar224/cortes9601400,Detalhes318únicaaba e controles futuros316/317; não se declara igualdade pixel a pixel da página inteira.

Pendentes finais: incorporar registro NÃO-REGISTRO específico da aba do contato enviado peloROOT e sua guarda dirigida; revisão independente TESTER/global coordenado pelo integrador. Recorte106/1058 de8b não incluiu a nova guarda de identificação; não é global e não autoriza presumir homologação. Fonte visual/runtime mantidos, sem pacote/schema/backend/DB/envio.

## Freeze final após registro de identificação

Merge normal e5941b8c em f6f104d8f00df8f4fc172a941e93c8074d35dcbe; único conflito documental no quadro, preservados ambos históricos. Delta de src/scripts contra runtime8b: somente src/app/identificacao-registro.test.ts (registro ancorado de chave enum de navegação, sem algoritmo/UI). Guarda observada em execução819428:1arquivo29testes EXIT0; lint do arquivo0avisos EXIT0, Node22.23.2. Os gates de produto106/1058,TSC50243/lint24 permanecem da fonte8b idêntica, não são reapresentados como nova execução. Allowlist positiva final107arquivos/98PNG/14.040.081bytes novamente conferida byte/hash. TESTER e global integrado peloROOT pendentes. Nenhuma suíte global própria, DB/browser/servidor ativo ou mudança de ambiente.
## Revisão C1 da PR401 — composição dos pais

Base315-r3@ab14161d incorpora3995b776f por merge normal, sem mover4ddd;
fonte5a308c62 preserva cabeçalho/menu/ações/Conversa/scripts315, recebendo
somente oito arquivos de prazo puro/Avatar/SSE e testes dos produtores.
Não muda permissões/servidor ou a regra de nota interna. C2 da revisão403
permanece separado na funcionalidade317.
Recorte6/81 e global42416 EXIT0:887arquivos/6.950testes,sem filtros/ignorados;
Nexttypegen/TSC61138 e lint86951 EXIT0,0erros40avisos anteriores. Sem novo
DB/browser. TESTERexato/CI/main/#392B2 pendentes. output/pr401-qa/revisao.md.
