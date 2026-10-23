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
