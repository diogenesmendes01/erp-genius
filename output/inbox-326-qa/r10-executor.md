# QA independente R10 v2 — #326

Favorável ao preparo offline do pacote corrigido, sem GO operacional nem aceite das futuras imagens. Pacote 33.008 bytes/SHA256 32d808d740fa757e19fb3d8db5c5eaeb723432f1165310f9195062f6e6d8d128; main 18.270 bytes/e2a22a019a77ab2538a6606d28964c0f0d986680636ad6d4c35651b260d4a53e; observador readonly 8.106 bytes/c6aa805dd98ee53fabf3070c64789cf9eddffe365396a600a6738d023fbfe363; DOM 781c06d74dce2c8d63e5fd263aef8b8aa9f52ae7368dd5cb3efb515a44591052 inalterado.

Cópia própria em output/inbox-326-visual-r10-v2-review-tester: 35 artefatos, 58 pins físicos e 21 fontes APP conferidos. RuntimeAST TypeScript 3ae902...7675 é byteigual ao instalado no T; a cópia privada permite o import relativo do teste, sem instalação ou mudança do ambiente. Também reconferi os 30 originais c371 tanto no snapshot T quanto na preservação B: todos continuam byteiguais, com seu RED e parecer negativo intactos.

Gates próprios, terminais 0 e zero skips:

- dc31f8: quatro arquivos completos do pacote (observador-leitura-r10,visual-r10-dom,visual-r10,visual-r10-v2-causais), 24/24, 810,55 ms. O causal extrai BODY_ATUAL por AST e usa criarApi326 real com transporte falso, sem rede.
- 643607: replay independente dos quatro oráculos anteriores (incluindo controle) mais controle negativo de canônico incorreto, 5/5, 411,3382 ms. Usa expressão real e coletores reais. São verificações sobrepostas aos do pacote, não 29 testes de produto.
- 644d89: identidade/delta mínimo, imports, referências e contratos de hash, EXIT0.

Os dois bloqueadores anteriores estão fechados neste candidato:

1. O main agora compara hashCorpoDetalhes325(v0.corpo) com detalhesCorpoCanonicoSha256. Proof novo BE059EB7979F470F9338A1088E010876F8A0EDEF36B83059B48D0D9885C48DA2 nomeia explicitamente raw b9ab3f...c825 e canônico 4741dc...37a6. Raw e proof 58f2 históricos continuam preservados. DTO igual com ordemJSON diferente passa; canônico errado é rejeitado mesmo com raw correto.
2. Recuperação readonly exige abortado sem headers OU status 200, além de ERR_ABORTED e substituto posterior da mesma identidade/URL com corpo V0 completo. Cabeçalhos 403/500 são rejeitados pelo próprio observador, independentemente da auditoria geral, que também continua registrando HTTP ruim. Controles sem headers/200 passam; os RED c371 não foram reclassificados.

Conferência literal do delta: normalizando apenas pin/path do proof e nome do campo canônico, o main retorna exatamente ao candidato c371. O observador difere exclusivamente pela restrição (!e.headers||e.status===200). DOM, bridge R9, observador original 326, helper SSE a118, sanitizador e módulos compartilhados são byteiguais. Prova output/inbox-326-r10-v2-identidade-tester.json SHA256 1b02b4baca7022217e8396a5451a9318d854af8da22ff675df2905a96a374586.

Escopo continua seis APP novas no estado inicial sem diff/Salvar disabled, nos três tamanhos/dois temas, e seis PROTO históricas legítimas reaproveitadas. Seis arquivos de referência foram novamente conferidos por hash/bytes/dimensões; os pins atuais HTML/support e a proveniência nominal já auditada são mantidos, sem inventar pinruntime antigo nem chamá-las recapturas.

A revisão do fluxo mantém guardas de APIRequest/browser independentes, único ator por contexto, 0 Save/submit, origem/pessoa/actions/provas fechadas e READY 520 novo. Observador separado de leitura usa somente V0 atual, full START/header/body/hash, recuperação posterior estrita, barreira/selo/auditoria após close; não fabrica ciclo Save e não altera original 326. Save e POST desconhecido são negativos. EventSource nativo exige terminal real da mesma Page/request ainda viva; finitos/handlers e falhas tardias são auditados depois de fechar contexto/browser.

Seletores usam role=dialog, Salvar é associado ao form no footer; empresa/link condicionais ao DTO/capacidade. Estado/tema/valores/labels/form, foco/inert local, geometria e alcance dos controles via scroll natural são verificados. Não exige formulário/tabpanel inteiro no viewport, 11 controles simultâneos, glifo checkbox 44 ou ausência de badge. Antes PNG restaura topo/foco e drena; depois PNG relê e compara assinatura/versões antes de selar. Novo GET ou alteração DOM durante captura permanece negativo.

Limites: DOM/retângulos controlados e EventEmitter não comprovam a operação nativa ou o aspecto das seis imagens. A assinatura de valores/geometria não é uma nova prova de lifecycle React além da R9 nominal. Nenhuma Save adicional é necessária/autorizada neste plano. R7 continua negativa, R8 delimitada, R9 positiva nominal e c371 negativo. Integração 798f/CI e aceite visual/anexo C1 continuam separados.

Não executei main, HTTP, browser, DB, grant, Save, PNG ou nota; não alterei SRC/harness comum/cliente/perfil. Checkout 798f/cliente 490 preservados. ROOT ainda precisa conferir fresh 520/admissão e conceder GO do hash exato. Parecer UTF-8 sem BOM/LF.
