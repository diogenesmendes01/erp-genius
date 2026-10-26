# #328 — R1: selo de foco no callback de perda e Funil

Base fa7a554c2a665acd8d3c57cc4c7098e9c3cb318d, mantida em ref/artefatos com seus gates/QA nominal. Produto runtime87c01c49 preservado. ROOT confirmou por leitura4fd103 que perda retornava só campo/Voltar/confirmar, e o fixture modal() não estabelecia foco; fill focar normalmente não era uma prova de foco no momento do selo. Funil tinha contains+acessivel, mas não perceptibilidade do elemento ativo.

Correção mínima: helper interno focoValido lê document.activeElement e exige isConnected,!disabled,modal.contains e visivel existente, incluindo clipping/opacity/árvore acessível. Dois retornos aplicam a mesma guarda em perda e Funil. Nenhum focus() no driver ou mutação DOM/CSS; não se alteram produto/useDialogo/Modal/shareds/CLI/declarações/originais/coletores/pinos. O callback continua autocontido e somente leitura, executado também serializado porVM.

Testes positivos agora chamam foco real apenas no fixture e assertam activeElement/isConnected.26negativos por dois ramos preservam controles do formulário enquanto invalidam só foco:BODY,externo,desconectado,displaynone,visibilityhidden,hidden,inert,aria-hidden,disabled,opacity0,clipping,foraViewport e retângulozero. Incluem dois positivos novos de foco interno perceptível/conectado, além dos controles anteriores.

RED72f6f9 EXIT1:18falhas/100controles118total. GREENe70747 EXIT0:arquivo COMPLETO118/118,723ms,w1,sem filtros internos/skips;lint2 EXIT0 semwarnings. TSC_R1: 9345/bd4aa7 EXIT0, Node22heap8192/noEmit/incrementalfalse, config original sem aux/exclusoes. Não repetir4/128fa7 ou TSCfa7 como se comprovassem esta fonte. O parecer negativo TESTER de fa7 permanece nominal, sem misturar o fixR1.

ProvaFS/AST: arquivoMJS inteiro é exatamente fa7 mais helper/dois retornos; todas as outras funções são literais, inclusive aberturas/finalizadores; zero chamadasfocus no MJS. Teste anterior literal exceto helpermodal/asserções positivas explícitas e os novos casos. Manifesto novo output/inbox-328-harness-foco-r1-fontes.json registra ambos namespaces físico/GitLF/OID, pacoteanterior preservado, vetor protegido e evidências.

As30cenas/CLI268 não mudam. Não houve DB/HTTP/browser/captura/fixture/preview/ação/upload. Native,QA exata e admissãoROOT continuam pendentes. Esta revisão detecta foco inválido; não produz nem presume foco nativo correto ou aceite de imagem. Nenhum selo restante foi dispensado.
