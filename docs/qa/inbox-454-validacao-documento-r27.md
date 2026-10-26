# PR454 C1/C2 — validação documental, rodada27

A Pessoa agora recusa documento reprovado pelo validador conhecido do tipo escolhido. A regra vale quando documento, tipo ou país emissor é fornecido para gravação, inclusive se o valor inválido histórico for reapresentado sem mudança. Documento continua opcional, e o limite de100 caracteres é compartilhado pelo servidor e pelos dois formulários.

A decisão humana callc76fcdd está registrada no [comentário da PR454](https://github.com/diogenesmendes01/erp-genius/pull/454#issuecomment-6421415187). Ela substitui a regra histórica de apenas informar a flag. Grupo omitido, propriedades undefined e DOB-only preservam o legado; tipos sem validador conhecido e ausência de tipo não recebem uma regra CPF por inferência. NULL e limpeza continuam opcionais.

## Fonte e escopo
Base DEV546cfedd55e805c014b46fcf0a4354e68aa5bdff. O servidor362 permanece congelado. O ROOT selecionará somente o delta documental sobre o público d17391f90e54a36a0e165bc4f373b70ee6217a93, sem importar os ancestrais privados.

DOCUMENTO_PESSOA_MAX=100 acompanha os documentos contratuais e de pagador já limitados a100 e comporta CURP18 e os demais formatos LATAM com pontuação. Não há truncamento, máscara CPF, alteração de nascimento/idade, ACL ou D13. O predicado usa somente chaves próprias do registro canônico. A inversa da adição do export reproduz o hash042d71b95e19604e802cee329b5449b975ae495d819f2a08001c70fe0058c19c: os corpos dos validadores de Aluno ficaram literais.

## TDD e verificações estáticas
|Execução|Resultado|
|---|---|
|RED inicial2fc391|5 arquivos/124 casos,11 falhas assertivas e113 controles|
|RED anti-noop b740da|5 arquivos/129 casos,14 falhas assertivas e115 controles|
|GREEN06d1a6|6 arquivos completos/175 casos,EXIT0|
|Lint de produção a62e90|11 paths,EXIT0|
|TSC produção c60993/sess1652→c1cc04|original8192,EXIT0|
|Lint nativo/fixture62475b/0acc03|EXIT0|
|TSC nativo0acc03/sess32138→d768fd|original8192,EXIT0|
|Lint/TSC do literal pool1 68aa39/sess66471→92302d|EXIT0|

Os seis arquivos cobrem writer/schema, dois formulários, form-diff e validadores canônicos. Incluem seis validadores reprovados e seis válidos LATAM; grupo explícito invariável, troca de tipo, unknown/vazio/null, DOB-only/undefined/no-op válido; limites100/101; preservação do rascunho após recusa e nomes herdados do protótipo. Não houve falha de coleta ou TypeError nos REDs. Warnings de useLayoutEffect na renderização estática não constituem prova de navegador.

## Nativos DEV concluídos
|Arquivo completo|Início/sessão→terminal|Casos|Duração|
|---|---|---:|---:|
|crm/pessoa-cadastro-validacao454.int.test.ts|aa3f8a/61926→0662e3|5|24.62s|
|crm/pessoa-cadastro.int.test.ts|6dce98/70802→8231e4|7|31.71s|
|inbox/painel-cadastro-pessoa.int.test.ts|a55f7a/34797→7834a3|5|21.77s|
|inbox/pessoa-cadastro-concorrencia.int.test.ts|150af0/66400→073c01|8|37.35s|
|inbox/pessoa-cadastro-notify.int.test.ts|2e3af7/84575→8f95d3|3|14.90s|
|inbox/pessoa-cadastro-pool1.int.test.ts|9ea607/73176→a2e2c3|3|15.19s|
|crm/pessoa-cadastro-redacao.int.test.ts|64de8d/92520→fbaa73|3|14.81s|
|crm/pessoa-cadastro-cache.int.test.ts|72e97f/89849→959f4c|4|18.13s|

Todos terminaram com EXIT0:38 casos em oito arquivos distintos. Os cinco primeiros arquivos foram aprovados antes da interrupção descrita abaixo; os três últimos em nova lease, com produção/helper inalterados. Não são uma suíte global nem uma execução única. OriginalINT, dev-emailA502/clientDF, UTC, sete provedores vazios, Hermes1024, um worker e sem arquivos paralelos. Sem filtros, skips ou repetição dentro da lease.

O novo nativo5, fonte d378251aa4039eebbc48dd18e733ea54b6b41c25dc204ddeb7c76523bf2eeee2, provou:
- Pessoa inserida só com campos antigos mantém os quatro novos NULLs; UPDATE autorizado grava cédula e Evento apenas de presença.
- CRM e Inbox recusam o antigo FICTICIO-LATAM340 e101 caracteres com erro exato, sem alterar Pessoa/Evento nem ecoar o valor no erro/logger. Seu canário de captura é console público, não uma alegação de logger Prisma global.
- Reapresentação explícita de inválido histórico recusa; grupo omitido e DOB-only preservam os valores.
- Seis tipos reais do catálogo LATAM recusam inválido e aceitam válido, com redação do Evento.
- Tipos sem validador/futuro/protótipo aceitam100; NULL permanece opcional; o guest409 recebe erro CRM canônico, sem oracle de formato ou alteração de DOB.

O arquivo legado de redação preservou emissão real de dois canários Prisma no canal console.log. Artefato04fc61fcbf7837eb84eae8639d198cf2fe8b8aa35417de4d9b965f4d645ba7ee, com canaisCanario=[[log],[log]] e emissaoRealPreservada=true. Os controles de PID/DB/app/FK e rollback continuam nominais ao teste existente.

## Fixture positiva e tentativa interrompida
O ROOT coordenou a troca de uma linha de entradaCadastro: documento inválido FICTICIO-LATAM340→cédula válida1-0234-0567. O helper mudou de dc9f4776be94a248a2da74622590eb5b024ac87cd47b99caef263c964448835d para8b03f93e26904cb680dc2147e6319d9fc742517fbf55f5dfcafc2c92231d4c70. cenarioCadastroPessoa e os outros helpers permaneceram literais. O valor antigo está preservado como negativo explícito no novo nativo.

A auditoria inicial identificou cinco consumidores, mas deixou passar um assert literal no pool1. A execução393ab0 terminou EXIT1,2/3: o getter retornou a cédula correta, enquanto o assert esperava o valor antigo. A sequência parou; redação/cache não rodaram naquela lease. O negativo foi preservado no recibo90995540 e no log, sem alterar testes ou repetir durante a lease.

Após restauração ROOT419a65 e autorização, somente o literal esperado foi corrigido. Fonte pool1:215f47bc1068ef0824a1a42d35d36d835274a2f04fc1e326881d562d6bc7bd67→e44434c5fd2c50f7d38f9a2a29ae23a989024649086a163246f5ecb7a42e36ec. A inversa recupera o snapshot anterior byte a byte; nenhum assert de formato, ACL ou redação foi relaxado. A nova lease aprovou pool1/redação/cache completos. A tentativa antiga não é somada aos38 casos aprovados.

## Recibos e limites
Recibo nominal dos oito arquivos: output/inbox-454-native-green38-receipt-private.json, SHAe4bdcd21a4066814fea771fc81e7f3b0e2635e3f0a0f1d5bd96e3188dd111d6f. Guarda sourceSHA/logSHA, sessões, terminais e contagens; os17 pins ficaram congelados durante a última lease.

O ROOT confirmou restauração final2680d9 EXIT0, A502/566 linhas baseline. A migração499 aplicada permanece rawb10889625df3dfe95afbec737d28c8c02e102eba42dc758aee2d767fd8adc5b6, sem DDL, schema, backfill ou regeneração de client. O DEV não executou restauro, instalação, mensagens reais ou integração externa.

Esta é a evidência DEV do deltaC1/C2. QA independente no candidato público exato, gates integrados/CI, aceite visual e merge continuam pendentes. Não presume conclusão da issue340 ou homologação da PR454. Commit local ainda depende do GO do integrador; não houve push.
