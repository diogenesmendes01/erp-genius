# QA independente #325 — visual final d775

Parecer favorável ao corpus delimitado, sem bloqueador visual encontrado nas 36 imagens originais. Esta inspeção fecha a revisão visual independente do material entregue; integração em main, CI, publicação e decisão humana de homologação continuam sob o integrador. Não houve browser, HTTP, banco, Save, nota, envio, Prisma, instalação ou execução de testes de produto nesta rodada TESTER.

## Fonte e atribuição

Checkout TESTER exclusivo em `d775a140b824e56307d50d95d7bb0ad5284a5f6e`, detached e sem alteração tracked. Preflight `4db1b6` preservou inventário/hash de 1.045 arquivos privados. O delta versus harness `96c9e60752b3c1951922a745cee89045b4597ace` contém apenas sete MD/JSON. `src/app`, `src/components`, `src/server`, `src/lib`, Prisma, package e lock são idênticos à APP `ddf872e13078fb48c7648da9c2fc48b1d3f29438`; as diferenças sob `src/test` são os testes do harness. Nenhuma alteração de schema/dependências/permissões foi introduzida pelo freeze documental. As oito fontes de runtime registradas em L1/L2/probes correspondem aos hashes físicos da allowlist e seus blobs Git LF conferem com 96c; diferenças CRLF previamente auditadas não foram ocultadas. Guardas953, SSE e recuperação estrita permanecem as revisadas em `inbox-325-96c-coletor-final-review-tester.md`.

Não reexecutei gates anteriores. Minha prova APPddf é UNIT69/726 `74322/691eb2`, INT3/41 `38918/b98407`, TSC `17401/2f198a` e lint9 `ccd896`, todos terminal0. Minha prova harness96c é UNIT17/150 `90c840`, TSC `27039/2bd520` e lint4 `831ea1`, todos terminal0. São provas distintas desta leitura visual.

## Corpus e integridade independente

Li cada uma das 36 PNGs reais individualmente com `view_image`, em resolução original, sem depender de pranchas ou miniaturas. O diário `inbox-325-d775-integridade-tester.json` enumera cada arquivo, SHA256, bytes, dimensões, lote e inspeção TESTER. Cobertura: PF/B2B/leitor APP em 1440×900, 1024×768, 390×844 e complemento 320×500, ambos os temas: 24 APP. PF/B2B do protótipo em 1440×900, 1024×768 e 390×844, ambos os temas: 12 PROTO. Matriz220 =190 preservadas+30, com seis complementos APP320 fora das30 formais.

Executor offline `c78179` EXIT0 verificou assinatura/dimensões PNG, bytes e SHA dos 36 arquivos curados contra allowlist e respectivos originais de L1/L2: total3.434.158 bytes. A origem nova foi conferida no manifesto e no arquivo do lote, inclusive quando pixels produzem hash igual ao de captura negativa anterior; igualdade de pixels não transforma o lote negativo em aprovação.

ZIP privado `inbox-325-aceite-ddf872e-96c9e607-20261024.zip`:3.361.508 bytes; SHA256 `37f09534f89890984efb6316fe9ccf999593097306b711f301248d28f3b28d69`. Li/descomprimi em memória as38 entradas, conferi CRC32 e SHA de todas:36 PNG+`manifesto.json`+`README.md`, sem arquivo extra, caminho externo ou bruto privado. Manifesto e README do ZIP são iguais aos respectivos blobs Git LF, sem confundir CRLF físico com alteração de conteúdo. Não publiquei/anexei o ZIP.

Documentos Git LF conferidos: visual.md8182B/SHA `50be3c8d86110e35417138cdfcbfd2f21b09b833ddf5ebffecf0618ac13a7470`; allowlist31330B/SHA `5ad12b67d93825c1c6e53d8c9d819caee5234e7cc0da5043cf2978fcc411b543`; README3040B/SHA `57e4cdfe01605ac0fada4e6a49a1e50322bd716c5631ff6a31165478c812cbc4`.

## Julgamento dos pixels e D13

PF tem avatar circular e PJ quadrado132; cabeçalho distingue empresa de interlocutora. O cartão mostra valor total CLP da fixture LATAM, sem inventar mensalidade; documento da empresa é o RUT fictício completo `76.086.428-5`. Tema claro/escuro, hierarquia, contraste aparente e leitura do painel são coerentes com a referência. Não fiz medição instrumental de contraste.

Em320 o documento e seu rótulo ficam contidos, sem truncamento horizontal. O painel usa rolagem vertical interna; no corpo PJ longo uma próxima linha pode ficar parcial na borda inferior de500px, sem promessa de todos os dados caberem simultaneamente. Em1024 o painel sobreposto ocupa a lateral sem extrapolar o viewport; a conversa parcialmente atrás é a composição prevista. Desktop preserva separação visual e hierarquia.

AdminPF mostra campo reservado da fixture, marca de autoria e ficha completa. Nas oito imagens leitor não há campo reservado, marca Aria, edição de tag, ficha completa, Ver empresa ou Falar com B; Falar com A permanece. O nome de B como contexto permitido não foi confundido com autorização de navegação. O valor `campoRestrito` no metadado bruto é a sentinela negativa esperada; a semântica exige que esse texto esteja ausente do DOM. Não é vazamento do campo.

O cartão contextual de Oportunidade atual com `/funil?o=...` continua no leitor, conforme contrato expresso da SPEC até #327. Não afirmo ausência de qualquer link Funil, acesso global ao CRM nem teste de chegada do leitor ao Funil: os probes dessa chegada são de admin. A capacidade para fichas globais e a autorização do destino seguem independentes do convite contextual D13.

## Lotes e prova de coleta

O corpus é composto. L1 `74891/eb2985` permanece EXIT1:19 contextos fechados, browser fechado,18 APP selecionadas por arquivo; o primeiro PROTO falhou antes de produzir PNG. L2 `18441/ba4c36` EXIT0:12 PROTO+6 APP320,18 contextos fechados/browser fechado. Não chamo L1 de lote verde.

Conferi os manifestos privados originais, preservados no B: L1 SHA `01980fdfaf4ea6e943d67ea8b04ea2541102fe9faad8b2b02fec6e34c0a4a726`; L2 SHA `bc2083d5f5af12ed3feb3bf7a9381d3115849c117dcc9d486521a1f60984fbed`. Executors físicos L1 SHA `4a5323e1190d01eaa4744586dae58d2679cf734a5ea834ba6c191287249852bc`; L2 SHA `0b510f0d634ff43f3a0d167b0645e37943f7226178bffef78a12340681fa2f51`.

Auditoria offline `acb4e8` e asserts `002db7` EXIT0:24 APP sem falha final,71 START/71 settled/0 pendências; todas com ID atual=esperado, semântica final, selo, fechamento e aceite pós-browser. Recuperação depende de substituto posterior íntegro do mesmo contexto/página/atendimento e hash de corpo esperado; não se resume a status200. A observação START até encerramento é a corrigida96c, sem o falso verde d1f51. As72 ocorrências de links alcançadas por Tab têm dimensão mínima real44px, entre2 e51 Tabs, inteiras no viewport na hora do foco. O executor também exige document.scrollWidth<=viewport+1 antes de capturar; PNG e alvo focado não demonstram todos os estados possíveis de resize.

SSE nas capturas:duas aberturas sequenciais/max1 simultânea por página. Nos probes de duas abas o limite é por página; não afirmo uma única conexão global para ambas.

## Referência estática original

L2 registra36 ocorrências em `limitesReferencia`, exclusivamente PROTO, da mensagem `TypeError: Cannot read properties of undefined (reading 'sel')` com os dois callsites exatos (eval da lógica:143:202 e support.js:1013:24). O matcher não se aplica a APP nem aceita qualquer TypeError. Hash original HTML `7698a34bad041c95f45710cfe3ed6f79a97ba5f49bf5d941751c37324233d8cf`; support.js `d6bb6dd3aadb9ff722d5d6db2193572ece476b915899575a571de7a0717f001f`. Originais não foram editados, nem DOM/estado fabricados.

O support passa apenas prevProps; a lógica define prevProps/prevState e acessa prevState.sel após commit do DOM. Isso permite comparar o painel estático já desenhado, mas interrompe parte do lifecycle: não comprova autoscroll, foco, seleção ou comportamento funcional equivalente do protótipo. Abas futuras/CPF/periodicidade mensal e dados próprios do protótipo não foram transplantados como requisitos APP325. Leitor é APP-only, sem referência de autorização por convite inventada. Ver adendo anterior `inbox-325-proto-74891-limite-estatico-tester.md`.

## Probes registrados, sem nova navegação TESTER

Li os seis resultados de `53179/a656b7` EXIT0 e o executor realmente executado `probe-inbox-325-private-lote53179.mjs`, SHA `fd95c2dd9a825b006bd57e6bcad71f01768b37fcd4bc5243cc8ab5faf4068245`. Manifesto privado SHA `7c7d1b6339c075c75a2f26ae34b7062b7e93de2b863ea7c90c082757c2800be8`; seis contextos/browser fechados, sem falha final na origem/chegada. Origem exata permitida `http://localhost:3111`; skip explícito de about:blank. A versão futura guardinit por origem estrita tem outro arquivo/hash e NÃO foi executada; não a atribuo a53179.

| Ator/probe | Destino e oráculo real |
| --- | --- |
| Admin PF cartão | `/funil?o=inbox-325-op-pf`; heading do diálogo `Mariana Costa325`, distinto do produto `Espanhol Intensivo325` |
| Admin PF ficha | `/contatos?c=inbox-325-pessoa-pf`; article `Ficha de Mariana Costa325` |
| Admin PJ empresa | `/empresas/inbox-325-empresa`; h1 `Ventura Chile325` |
| Admin PJ A | `/inbox?c=inbox-325-atendimento-alvo-a`; Bianca Silva325, painel200/podeEnviartrue |
| Admin PJ B | `/inbox?c=inbox-325-atendimento-alvo-b`; Caio Lima325, painel200/podeEnviartrue |
| Leitor PJ A/B | A mesmo ID, painel200/podeEnviarfalse; B hrefnull/ausente e GET painel404 |

Todos registram URL local exata, chegada semântica e SSEmax1 em cada página. Os atendimentos A/B não têm lead: `/painel/detalhes`200 com oportunidade/b2bnull e DOM `Sem oportunidade visível para você.` são chegada legítima, não evidência de um DTO comercial de A/B. Oráculos reais substituíram a suposição indevida de título de produto.

A rota privada bloqueia outras origens e mutações fora da allowlist. Contabilizei99 chamadas incidentais permitidas nos brutos:66 respostasRapidasDoCompositor+33 marcarAtendimentoLidoAutomatico; nenhuma é Save, Assumir, Aria, nota, etapa, envio ou CRUD. A presença de marcação de leitura foi explicitada, não chamada de execução sem nenhuma mutação.

## Negativos, limites e encerramento

Preservados:26ab1b EXIT1/uma PNG rejeitada; c588cb EXIT1 sem PNG; falso verde d1f51 reproduzido em memória7f1915 EXIT1; L1 acima EXIT1; probe56898/2df241 EXIT1 por suposições privadas de título/about:blank. Não reutilizei negativos como gates verdes. Sem captura de novo comportamento de editor326, oportunidade327, participante sem autorização, indisponibilidade ou todos os perfis possíveis; sem medição instrumental de acessibilidade, performance ou nova execução de segurança.

ROOT informa preview stop97596/9d0c00 por Ctrl-C1 esperado, porta3111 fechada f2889a e restaurociint ae152c EXIT0/424 hashes/498 linhas; não revalidei por HTTP/DB. Meus executores deste fechamento são exclusivamente leitura/checagem local de arquivos:8af516,c78179,157855,acb4e8,85e18a,bd6d70,002db7, todos terminal0; `git diff --check 96c..d775` também0. As leituras de imagens não são testes automatizados nem capturas novas.

Diário de integridade SHA `e0decc6e6906e9484e0fbef2a3ef523a32912ee80dc4e3fe18fbdf356009d7a7`; diário de métricas/probes `inbox-325-d775-auditoria-brutos-tester.json` SHA `d24598d17c2c0be5e3b2898f2396a2b7c268829733e7e06f572f1b41c5e93d7f`. Ambos privados TESTER, sem credenciais, artefatos originais intactos. PNG/ZIP não foram incluídos no Git. Parecer independente limitado às fontes exatas, corpus e evidências descritos.
