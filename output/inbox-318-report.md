# Relatório DEV A — #318, checkpoint exclusivo

Base243c9348454b6cca5795a6afa747efa25ed3eef1; branch codex/inbox-e1-318. Investigação GitHub/Task13 em output/inbox-318-investigacao.md aprovada pelo integrador antes de implementar. SPEC docs/specs/inbox-painel-contato-abas.md. Fonte314 permanece na ref congelada. Sem alteração de InboxNovo/ConversaAberta/dialogo/BotaoIcone/harness/quadro. Nenhuma instalação/package/lock/schema/migration/envio/PR/push ou preview.

## Escopo implementado

PainelContato aditivo, fallback308 e uma montagem/foco/inert/Escape/cleanup preservados; cabeçalho132/nome/tags, uma rolagem local, único fechar/ref. ABAS_ENTREGUES só Detalhes, abas controladas com teclado/ARIA e contagem mono. LinhaCampo puro; PainelSetor sem padding externo. Tags mínimas e ordenadas apenas após pessoa comercial autorizada/não legal; marca pela associação sem autor, sem nova regra de ativo. Quatro registros específicos de guardas autorizados depois, sem alterar algoritmos ou registros alheios.

## TDD e execuções observadas — Node22.23.2

- RED6d16db exit1:14 novos falharam,8 antigos verdes e módulo LinhaCampo ausente. Cabeçalho/abas/tags não existiam; unidade server prova que tags faltavam e não relaxa guarda.
- Primeiro GREEN parcial c35c64 exit1:29 passaram/1 antiga asserção de dt literal falhou porque o novo tamanho12,5 foi acrescentado. Atualizada a asserção para manter a mesma cor text-gray-600 e incluir tamanho exigido, sem afrouxar contraste.
- REDf94d04 exit1: teclado de abas falhou,8 interações de casca passaram. GREEN955a98 exit0:5 arquivos33 testes, incluindo9 interações reais ReactDOM e9 unidades de tags. Lint dos10 arquivos afetados da mesma chamada terminou0/0avisos. DOM mínimo não implementa SVG: mock local de três ícones decorativos, nenhum utilitário global alterado.
- TSCheap8192 e recorte77973/499cc8 exit0:29 arquivos316 testes, todos os testes unitários da pasta Inbox + Avatar.test.ts + paineis-tags.test.ts, maxWorkers2, sem ignorados. Não é global.
- Antes de executar DB, identificado beforeEach truncarBanco no arquivo autorizado. Integrador fez snapshot completo em schema privado fora de public,424 tabelas/551 registros e roundtrip com hashes424/424. Só após confirmação foi usada a janela dev-email; perfil fixo conferido, sem outro banco/servidor/suíteDB.
- Integração19403/5e7b32 exit1:11/12 passaram. Fixture nova financeira sem matrícula explícita foi rejeitada pelo trigger existente. Corrigida a fixture com seedCobranca já importado e vínculo aluno/matrícula; nenhum domínio/trigger alterado.
- Integração final52198/5de25e EXIT0:1 arquivo12 testes, vitest.integration.config.ts, src/server/inbox/paineis.int.test.ts, maxWorkers1, perfildev-email; nenhum ignorado. Cobre novas tags ordenadas/sem autor/inativa já vinculada, outra carteira/linha, responsável legal, outro setor e convite revogado, além dos nove casos antigos. Exatamente esse arquivo foi executado; não paineis-envio ou outra suíte DB. Banco liberado e integrador informou restauração a33eba exit0,424 assinaturas idênticas,307/314 normal9mensagens4notas preservada.
- TSCheap8192+lint afetados37893/9016c0 exit0 após correção da fixture. Guardas a7bdd8 exit1:4 registros ainda ausentes/95 testes verdes (7 arquivos99testes): aba1, key a.id, aria-selected e tag1 em superfície. Integrador autorizou somente esses quatro registros; nenhum algoritmo/regex/limite geral ou componente alheio mudou.

Gates finais após os quatro registros autorizados:80530/fe07f5 EXIT0,36 arquivos415 testes (pasta Inbox+Avatar+paineis-tags e sete guardas listadas), maxWorkers2, sem ignorados; TSCheap8192+lint dirigido1172/8fa94a EXIT0/0avisos. Node22.23.2. Fonte sem mudança após esses gates, só documentação. Não é full global.

## Pendências

Integração com composição do Inbox/triagem/estado da aba após handoff313; BotaoIcone real36/rótulo responsivo, preservando um fechar e a ref; normalização de padding/divisórias de filhos sem perder aprovação Aria/ações/opt-out; CLI painel-detalhes + estados atuais, esperas/hidratação/anonDOM392, capturas app×protótipo e provas de altura500/nomes/tags longas/resize/foco. Sem teste real de geometria ainda. TESTER e global coordenado pendentes. Quadro global reservado ao integrador, não editado nesta fase. Não chamar checkpoint parcial de funcionalidade pronta.

Checkpoint exclusivo será integrado à fonte313585753da por autorização do integrador. Composição ainda exige liberação posterior; scripts/visual permanecem comB durante formal313. Banco dev-email restaurado pelo integrador, nenhuma nova suíteDB/preview permitida neste intervalo.

## Checkpoint e integração de contratos313

Checkpoint exclusivo64e67072f17efdbf8e781798eb7b07adaab4cd02. Merge313585753da concluído em9292dcbc58497461a13a78bb246b3033bcbc0081; nenhum conflito produtivo. Conflitos só em inserções adjacentes dos registros de guardas; preservadas todas as entradas313 e quatro318, nenhum algoritmo alterado. Contrato real BotaoIcone aceita rotulo/ref/tamanho36; ainda não consumido pela casca318 neste checkpoint. Harness313 foi apenas recebido pelo merge e permanece exclusivo doB durante captura, sem edição autoral318.

Após merge: Node22.23.2,92538/704135 EXIT0,45 arquivos448 testes, pastaInbox+Avatar/BotaoIcone/dialogo-retorno+paineis-tags+sete guardas; sem ignorados/maxWorkers2. TSCheap8192 82958/cc7763 EXIT0; lint dirigido9906b1 EXIT0/0avisos. Sem nova suíteDB ou preview. Integração12/12 refere-se ao checkpoint64 com paineis/teste inalterados no merge; não foi repetida na base9292 após restauração do banco. Não é full global.

Composição de InboxNovo/ConversaAberta e consumo doBotaoIcone real aguardam a liberação posterior anunciada pelo integrador. scripts/visual continuam reservados aoB, assim como sua captura3111/DB, que não foram tocados. Fonte combinada sem alteração depois desses gates; apenas esta anotação.


## Composição autorizada sobre4f1c2049 — checkpoint parcial

InboxNovo/ConversaAberta liberados pelo integrador apenas para painel/dados/abas/triagem, preservando abrir()/NovaConversa para fix313 separado. Montados contato/tags guardados por seleção, abasDoPainel/Detalhes com estado associado ao atendimento e callback que recusa abas não entregues. Telefone somente quando recebido; ordem WhatsApp→setor→Aria→ações→opt-out(não grupo)→triagem/revisões. Triagem não duplica na thread; ponte sem seleção mantida. Wrappers locais normalizam padding/bordas sem editar regras dos blocos. Uma instância PainelContato, mesmo ciclo308 e controle/ref382. BotaoIcone36 REAL313 consumido sem alterar compartilhado/helper: wrapper absoluto e rótulos responsivos aria-labelledby. Nome acessível computado/geometria ainda não provados no browser.

Node22.23.2: RED inicial dbfe2c exit1,5falhas/62verdes; duas expectativas corrigidas antes da implementação (classe36 real e triagem vazia significa ausência). RED correto d71627 exit1,4arquivos94testes,5falhas/89verdes; novo teste de remoção da triagem confirma a duplicata antiga. GREEN e0e7b0 EXIT0,5arquivos103testes incluindo9interaçõesReactDOM da casca. Lint7afetados d87994 EXIT0/0avisos; TSCheap8192 sessão68740/chunk3cb56b EXIT0.

Recorte amplo sessão71542/c69f92 exit1:41arquivos495testes,493verdes/2falhas. Mock SVG de InboxNovo.foco.test.ts não exportava Phone/ChevronLeft usados pelo novo cabeçalho; adicionadas apenas essas duas exportações decorativas locais. Outra falha herdada: confirmacoes.test.ts:582 rejeita todo caminho .test., mas helper313 dialogo-retorno.test.fixture.tsx continua corretamente varrido por ehFonteVarrida. Integrador coordena renome noB, sem mudar algoritmo/asserção/whitelist; não houve edição dessa guarda/fixture noA.

Após mock: sessão15776/chunk3a18c3 EXIT0,44arquivos463testes. Filtros reais: pasta src/app/(app)/inbox, Avatar.test.ts, BotaoIcone.test.ts, dialogo-retorno.test.ts, paineis-tags.test.ts e guardas botoes/fundo-sobre-pagina/contraste/contraste-elementos/design-system/responsivo/dialogos. maxWorkers2, sem ignorados nesses filtros. A guarda confirmacoes não integra esse segundo comando e permanece explicitamente pendente do renome313. Não é full global. No comando anterior foram também passados filtros sem arquivo src/app/alternancias.test.ts e src/app/sem-polling.test.ts; a guarda Inbox sem-polling real foi coberta pela pasta Inbox, sem criar arquivos ou mudar configuração.

Sem DB/preview/ações/harness/quadro nesta fase. Integração12/12 continua histórica sobre64 (serverpaineis inalterado). Próximo: checkpoint limpo, merge normal359a23fd (P2Novo), depois renome de fixture313; repetir recorte/TSC/lint na fonte combinada e coordenar janela visual. Não há conclusão presumida.


## Checkpoint de composição e fixes313

Checkpoint8b27b07a53b23c3f804cca1d8dbc665f4f0bb727 tracked clean, composição com abrir()/NovaConversa intocados. Merge normal359a23fd em1ecddf9604f23bee8266fb131cbdf5ec945b5694 sem conflito: preserva JSX318 e adiciona focoAoFecharPopover/regiaoConversa + fechamentoNova antes de selecionar; Coluna fechaFiltros/Seletor inclusive mesmaid. Recorte pós-merge345199 EXIT0,4arquivos57testes (InboxNovo.foco/ColunaConversas.interacao/NovoAtendimento.interacao/InboxNovo.interacao), Node22.

Integrador autorizou merge normal b10ecc981c8d2cb65b51d14cbe4c90f0392befff: resultou ed1b6593e3bf6df57d639543f767794b1e91e53b sem conflito. Inclui renome de fixture313 para dialogo-retorno.fixture.tsx +2referências/ledger e prontidãoCLI313 de seu pai2e882, recebidos por merge; nenhum script editado peloA. O fixture continua varrido e guarda confirmacoes passa sem novo bypass ou algoritmo alterado. Fonte de runtime/composição318 igual8b27 exceto fix313 localizado; helperdialogo não editado peloA.

Gates noed1b6593, Node22.23.2: TSCheap8192 sessão34729/chunkb5988b EXIT0; lint18afetados724157 EXIT0/0avisos; recorte sessão13396/chunk33eed8 EXIT0,47arquivos534testes,maxWorkers2,sem ignorados nos filtros. Filtros reais: pasta Inbox, Avatar.test.ts, BotaoIcone.test.ts, dialogo-retorno.test.ts, dialogo-retorno.interacao.test.ts, paineis-tags.test.ts; guardas botoes/fundo-sobre-pagina/contraste/contraste-elementos/design-system/responsivo/dialogos/confirmacoes. A falha de confirmacoes registrada antes está resolvida por renome313, sem tocar guarda. Não é full global e não inclui integraçãoDB.

SPEC consolidada para o estado atual, roteirovisual adicionado; sem mudanças de fonte depois desses gates. BancoA normal/livre e nenhum previewDEV. Integração12/12 histórica continua válida para serverpaineis inalterado; não repetida aqui. CLI/harness ainda exclusivosB investigando corridaURL/ServerAction; não editar helper/read/Nova em318. Pendências: handoffCLI/freezeB, janela previewA, medidas reais e app×protótipo, retorno de nomes responsivos, TESTERexato/quadro/global coordenado. Preparação usará tags canônicas Mariana(Pessoa307:Inglês/Adulto humana,Noite semautor) e AriaBeatriz antes de solicitar dados extras. Não marcar funcionalidade concluída.


## Probes privados normais e valor mono

PreviewA3110 liberado pelo integrador em9dd098d2, executor50441, banco normal307/314, providers vazios. Probe privado61211 exit1: espera getByRole excluía região Comercial ainda oculta no mobile; expectativa do probe corrigida para locatorCSS attached antes de abrir o painel. Sem mudança de produto por esse timeout, negativo normal-r1 preservado. Probe25376/88f359 EXIT0,18cenários em390/699/700/959/960/1024/1399/1400/1440×500 e dois temas,36PNGs locais em output/inbox-318-probes/normal-r2,anonDOMv1/hash por imagem/medidas.json. ACCNAME nativo viaChromeCDP correto (Voltar abaixo700,Fechar acima),único36/avatar132,Detalhes/teclado/Escape/foco/ref/últimoopt-out/overflow e zero warnings/externos. Fotos390claroTopo/1440escuroFim inspecionadas. Não são QA final após próximofix313.

Probe resize85381 exit1 e diagnóstico22735 identificam expectativa incorreta: cruzar1400 retorna ao automático por contrato308/teste existente; o teste esperava overlay continuar manual. Nenhum shell alterado. Repetir com fechamento/reabertura esperados, identidade/visibilidade/foco registrados, sem relaxar critério de foco inert ou overflow.

ReleituraTask13 detectou valor WhatsApp semfont-mono na composição. REDfcc388 exit1,1falha/19verdes; aplicado apenas spanfont-mono ao valor recebido e adaptada asserção de ligação. GREEN974260 (primeiro comando antes do probe diagnóstico) EXIT0,2arquivos62testes. Lint3afetados dirigido EXIT0/0avisos antes deste checkpoint. Sem nova consulta/permissão/estadoNova/read/helper ou alteraçãoDB. TSC/recorte combinado e provas visuais ainda precisam da fontefinal.


## HandoffCLI, fixACK313 e provas Aria — fonte9e080190

Delta mono aa3fcf90bee37fe291d4de22ab714d93c56b1bf2. Merge d95a7905 (ACK/paginação313) concluído em9e080190dbd4d0f011442a8ac35c7881e3c92b7b: nenhum conflito produtivo, JSX/aba318 preservados. Dois conflitos de testes: unido mockConversa comVoltar doB aos íconesPhone/Chevron doA; concatenação dos testes318 e ACK150 doB, sem descartar casos. Recorte456a08 EXIT0,3arquivos72testes. A fonte de sync/read/Nova só veio doB por merge. BlocoNext10linhasAGENTS conferido e deixado uncommitted até stop do integrador.

Resize e50e6c EXIT0:2temas×10passos(1440→1400→1399→1024→960→959→700→699→390→1400),mesmo aside/fechar/aba,foco natural não body/inert/oculto,fechamento automático/reabertura esperados,Escape/retorno e zerooverflow/warnings. Negativo resize-r3 preservado:setup addInitScript acessava localStorage emabout:blank; corrigido sósetup para originHTTP,sem filtrar erroproduto. resize-r4.json e probe privado identificam fonte9e080190.

FixtureAria aplicada SOMENTE pelo integrador,8da526 EXIT0:1Turno/1AcaoSUGERIDA NOTA_INTERNA emBeatriz,âncoraENTRADA307,semIA/execução/transporte,expiração24h;9msgs4notas/3tags canônicas preservadas. Prova privada20285/43b26d EXIT0:12cenários(1440×900/1024×768/390×844 e os3emaltura500,2temas),12PNGsaria-r1. Tab real chega aRejeitar desdeAprovar,botões dentro da rolagem e últimoopt-out alcançável. NenhumAprovar/Rejeitar/Devolver clicado. GETs após prova ainda trazem sugestão privada,9msgs4notas. Zero warnings/externos. Oito pranchas locais das36normais+12Aria foram inspecionadas, além das duas fotos individuais normais. Não presumir textos extensos/triagem visual: pedido de preparo enviado ao integrador, sem alteração própriaDB/nomes/tags/DOM.

HandoffCLI autorizado apósBfreeze2e882. TDD5129d8 exit1:5novos testes falharam por estado/semântica ausentes (um erro assíncrono do teste também registrado; promessa passou a tratar rejeição esperada antes de afirmar gates). Implementado painel-detalhes nos3tamanhos/2temas/2alvos=12PNG; totaltodos106(54app52proto),recorte31820PNG com tablet/celularpainel. Prontidão exige cabeçalhoMariana/avatar132/tagsAdulto/Inglês/Noitecom✦correta,apenasDetalhesativa/fechar36,setor e painel no viewport/transiçõesfinalizadas. Não exige thread depois que ela fica oculta. Protótipo usa seu próprio painel/Detalhes; abrir sóseoculto evita fecharcolunaautomática. CLIsemseed, hidrataçãoSSE/guardReact/rede/estados313/314 preservados. Manifesto acrescenta fonteApp porINBOX_VISUAL_FONTE e hashes4módulos; anonDOMv1 reaplicada aosDOISalvosantesfoto,política/versão/substituições registradas.

GREENc33733 EXIT0:4arquivos36testes deharness. Teste Chromeisolado f41c9b EXIT0,2testes(legadoNova+seletorsemântico318 que rejeita tagsausentes/abafutura/inert/viewport);não é prova doapp ouDB. Gates antesfreezeharness na fonte9e080190+deltaCLI: TSCheap8192 sessão23557/c20bef EXIT0,lint11afetadosc3e3f7 EXIT0/0avisos,recorte sessão55360/e72c5a EXIT0,51arquivos574testes,maxWorkers2,sem ignorados. Filtros do recorte anterior47 + visual-inbox-painel/visual-inbox/visual-inbox-coluna/visual-inbox-thread. Não é fullglobal/integraçãoDB. Fonteprodutiva sem mudanças depois9e080190; gates cobrem CLI318 que será congelada neste checkpoint. Capturas formais sódepoisdecommitexato, semalegarQA posterioraoR5382pendente.


## FreezeDEV318 após provas e URL313

20formais d04100cd concluídas23368/b56260 EXIT0(12painel-detalhes) e3508/a9d4fc EXIT0(4tablet+4celular). Cópia positiva por manifesto paraformal-r1,hashes4módulos conferidos,anonDOMv1 nosdoisalvos,zero falhas.20PNG somam2.120.022bytes; todas inspecionadas em10paresapp×protótipo. Diferenças aprovadas: sóDetalhes/conteúdoERP/subtítulosetor·número/sem edição+tag/cortes308. Fotos antigas não sobrescritas.

Variação longa aplicada SOMENTE pelo integrador9f646e EXIT0 depois dos browsersnormaisfechados:97caracteres/+12tagsprivadas preservando3canônicas eBeatriz. Probe85291/8f4484 EXIT0 emd041:6casos/12fotos. Novo fixURL3139c977ebb foi autorizado depois, recebido por merge normal semconflito em f5b7f5d018b2cbd61c793daf8827e3a4ffa5a4ff. Nenhum código próprio de sync/read/Nova/helper/VirtualList alterado; JSX/aba318/harness preservados.

Gates EXATOS em f5b7f5d0,Node22.23.2: TSCheap8192 sessão47314/0db150 EXIT0; lint11afetados1af411 EXIT0/0avisos; recorte sessão58625/791179 EXIT0,51arquivos580testes,maxWorkers2,sem ignorados nos mesmos filtros da rodada anterior51. Não é global,semDB/instalação. Probes4MJS que serão versionados também eslintdbc89a EXIT0/0avisos,sem novoignore.

Prova extensa repetida59417/cb72e9 EXIT0 nof5 apósfixURL:6casos(1440/1024/390×500,2temas),12PNGextenso-r2,inspecionados em2pranchas+390topo/fim originais. Nome97,15tags eavatar132,header905px(desktop/tablet)/880px(celular),scroller1407/1418px,últimoopt-out alcançado porTab/scroll;zerohorizontal/documentoverflow/focoinert/warnings/externos. Não reduziu avatar nem escondeu controles. Extenso-r1d041 permanece sóhistórico local.

Equivalência positiva5208ea:9módulos(PainelContato/LinhaCampo/PainelSetor/ConversaAberta/paineis+4harness) eJSXpainel de d041→f5 idênticos. Limite registrado: não é QA de navegação/leitura/SSE dofixURL313 ouR5382 futuro; não transferir gates anteriores aosSHAs novos sem execução. O parecer independente TESTER9e foi parcial favorável,10files139unit e3guardas71testes0 atribuídos aoTESTER; cópia preservada comfonte no nome, não é revisão finalf5.

PreviewA50441 encerrado PELOintegrador viaCtrl+C,exit1 esperado observado. Nenhum browser ativo. ConferidoAGENTSdiff10adições apenas blocoNext; restaurado sóAGENTSworktree apósstop. Integrador informou restauro completo do dev-email34417 EXIT0:424tabelas/hashesoriginais,canônicas307/314 preservadas,fixtures318Aria/longa retiradas,snapshot privado mantido. Não executarDB/preview novo sem janela.

Entrega selecionada:80screenshots=20formaisd041+36normais9dd+12Aria9e+12extensosf5;20pranchas;9JSONs e4probes. Allowlistpositiva em output/inbox-318-probes/allowlist-positiva.json contém nomes/tipos/fontes/SHA256/bytes.12.494.747bytes emimagens selecionadas(screens+pranchas),nenhumPNGnoGit. Negativos,tentativas de setup,logs,HTMLbruto,refsantigas,seeds/snapshots/credenciais excluídos. Não copiar pasta inteira. Dados específicos são fictícios/preparados pelo integrador; sóanonDOMv1 antesfoto,sem mapaoriginais.

Pendências finais: TESTERexato/QA visual independente/globalcoordenado do combinado e publicação pelo integrador,quadroglobal318 reservado aele;R5382/navegação finalBfora do escopoA. Triagem/grupo/telefoneomitido comprovados por testes de serviço/SSR/ligação,semclaimfoto real não preparada; fluxos de confirmação/aprovação/opt-out não executados nosprobes. Source freeze f5,commitposterior somente docs/JSON/probes. Nenhuma nova implementação iniciada. Próxima315 somente investigação read-only após entregar este freeze e semcheckout.
