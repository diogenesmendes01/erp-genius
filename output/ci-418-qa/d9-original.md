# QA independente #418 — comando de logout e auditoria administrativa

Parecer favorável ao commit exato `d9c1d0bb8b88f2447bfcf90eb13d79fc9fd6786f`, pai main `ae56c00f053e864a3efea35d2f640afe48716cc4`, árvore `4652761e123b5aed309299d0dff2fb7dbee29ea7`. A revisão estática e todos os gates próprios terminaram sem bloqueador identificado. CI/PR419/revisão humana/merge permanecem separados deste parecer. Não houve motor real, browser, UI ou alteração de dados por ação manual.

## Fonte, isolamento e lease

Worktree exclusivo TESTER, checkout detached9c88e2 EXIT0/tracked limpo, sem reset/limpeza.1.072 privados anteriores conferidos e inventário1.076 não tracked, incluindo ignored. Perfilintegracao, cliente487 físico SHA `e24658b28818cf2bd124071f3ea41c7682b03581de9bb27a1ea122388e297200`, schemaGit OID `1f575691cde242124c1493b8406121e8830a6f7e`. ROOT Next/READY `aa6fb8` EXIT0 precedeu qualquer runtime. Lease exclusiva `erp_genius_test` local54329, snapshot494 restaurado c82270 e liberado pelo ROOT; nenhuma outra suíteT simultânea.

Diff7paths=2produtos(sessao.ts/acoes.ts)+2testes+SPEC/report/quadro. Sem schema/SQL/dependência/lockfile/transportes/workflows novos. AST TypeScript próprio `bb3a57` EXIT0 confirmou corpos idênticos ao pai para tirarDeOperacao, desativarNumeroWhatsApp, excluirNumeroWhatsApp e desconectarNumero: frescura da releitura naTX, intenção/autor e fluxo administrativo não foram reescritos. Mudou somente a chamada do helper para o comando sem persistência. Manifesto `ci-418-d9c-fontes-tester.json` SHA `b521e72e07a50d17a3df7b78aa266b1b3d3b173fec1e57e2662a71453cefb4c7` registra quatro blobs/hashGitLF, funções e ambiente; diff-check pai..HEAD0.

## Gates próprios observados até terminal

Node22.23.2/Vitest4.1.11/executáveis locais; nenhuma instalação/Prisma/generate/migração manual/controle de cluster. Configuração unitária exclui integração. Sem filtro de nome ou skip imposto; recortes completos dos arquivos, não globalERP.

| Gate | Sessão/inicial → terminal | Resultado |
| --- | --- | --- |
| UNIT sessão+clienteMotor completos | 205109 | EXIT0,2 arquivos/37 testes,0,493s,maxWorkers2 |
| INT administração+processamento de sessão completos | 7633/50a63e → f9caa5 | EXIT0,2 arquivos/40 testes,138,00s,maxWorkers1 |
| TypeScript | 43274/8b6b06 → 0933a8 | EXIT0,sem diagnóstico,heap8192/incrementalfalse |
| ESLint4 | 346be5 | EXIT0,zero avisos,teto0 |
| Checagem final fonte/privados | a7217c | EXIT0,HEAD congelado/tracked limpo,1.076 hashes preservados |

Comandos (`node` corresponde ao executável absoluto fornecido pelo integrador):

```powershell
node node_modules/vitest/vitest.mjs run src/server/whatsapp/sessao.test.ts src/server/whatsapp/motor/cliente.test.ts --maxWorkers=2
node node_modules/vitest/vitest.mjs run -c vitest.integration.config.ts src/server/whatsapp/acoes-numero.int.test.ts src/server/whatsapp/motor/processar-sessao.int.test.ts --maxWorkers=1
node node_modules/eslint/bin/eslint.js src/server/whatsapp/sessao.ts src/server/whatsapp/sessao.test.ts src/server/whatsapp/acoes.ts src/server/whatsapp/acoes-numero.int.test.ts --max-warnings=0
# NODE_OPTIONS=--max-old-space-size=8192 apenas shellTSC:
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
```

A mesma sessão7633 foi acompanhada até terminal0; silêncio não contou como aprovação. Banco liberado ao ROOT somente apósf9caa5; nenhum acessoDB posterior pelo TESTER. Restauro posterior não foi executado nem presumido por mim. Os avisos existentesVite/mixed exports não foram falhas de teste. GlobalSetup padrão da integração pode verificar status de migrações em leitura; não apliqueiDDL.

Recibo `ci-418-d9c-execucoes-tester.json` SHA `c372f404cb724215f272041c09dd77d640f6ddb9da99d7e452c7daaa0080b80f`. Logs privados:UNIT480B/SHA `662e659e9801aabe5a9d9f77c3c1c52bf85773c831e8ce0b577461961e25963a`; INT812B/SHA `c24320ef846b6461855ba2389389dc648526f1105b00a4b65d4587c4e2fae68d`. TSC/lint são comprovados pelos seus terminais, sem inventar arquivo bruto porstdout vazio.

## Contrato e oráculos

`solicitarLogoutMotor({providerRef})` faz apenas POST pela rota codificada existente e propaga ErroMotor; seu corpo não lê/grava estado local. O helper administrativo usa esse comando. `desconectarNumeroMotor({id,providerRef})`, API anterior, continua POST seguido de aplicarEstadoSessao local; o teste real preserva essa compatibilidade. A nova API interna não é uma nova action pública de cliente.

A transação administrativa relê a sessão atual depois da resposta do motor. tirarDeOperacao altera o estado/inativação/exclusão e registra NumeroWhatsAppDesconectado quando necessário com autor e payloadde da releitura; eventoDesativado/Excluido é da mesma transação. Não volta ao snapshot anterior ao comando para decidir a desconexão. No testeCAIU a simulação altera a sessão enquanto o motor responde, e o evento precisa registrar deCAIU. Não afirmo prova de todas as corridas concorrentes possíveis ou novos locks, que não fazem parte do delta.

Os testes exigem exatamente um evento de desconexão com autor/payload nas operações administrativas e na desconexão explícita. Desativação/exclusão repetidas não repetem POST/eventos; exclusão por outro autor mantém não-encontrado. Não atribuo à desconexão explícita a propriedade de não emitir um novo evento em chamadas futuras: o oráculo dela é ausência de duplicação por UMA execução, preservando o contrato anterior.

Falha do evento final é injetada apenas naquele tipo, após o fluxo ter atualizado estado e tentado registrar desconexão. Asserções verificam rollback real do estado e dos dois eventos locais; não são mocks de persistência. O comando externo já ocorreu e não pode ser revertido pelo rollback do PostgreSQL: a atomicidade aqui é local, não uma transação distribuída com o motor. Os testes usam exclusivamente chamarMotor simulado, sem efeito externo.

NUMERO_INEXISTENTE404 continua tolerado somente no helper administrativo; a API de comando propaga esse mesmo erro e indisponibilidade. Indisponibilidade administrativa recusa sem mudança local. UNITcliente usa fetchstub/configfictícia e cobre tradução dos errosHTTP/códigos; UNITsessao mocka comando/Prisma. INTacoes-numero mocka chamarMotor e usa banco real descartável; INTprocessar-sessao exercita recepção/dreno e idempotência/ordem dos estados sem motor real. Os asserts anteriores não foram removidos, e processamento de sessão não mudou de fonte.

## Negativos e limites

Reprodução ROOT4084/87c6a3 (28/uma falha), RED34808/f35559 (32/sete falhas causais) e REDunit2da5a1 (API ausente), GREENdc059b/11, INTROOT15687/6924fa/40, global91717/006c1a/926arquivos7313 eTSC/lintROOT são provas nominaisROOT, não novas execuções minhas. Esta QA teve zero falha de teste/produto. Não executei regressão global, UI/browser, motor real ou deploy, e não conto a dependência418 como uma nova entrega original do Inbox.

Negativo administrativo próprio bb9439 EXIT1: tentei ler nome de relatório não existente; o path correto output/ci-418-report.md foi lido em4b003e EXIT0. Não houve alteração de fonte nem falha de produto. Pareceres327/326/325 anteriores continuam privados e intactos, sem atribuir seus gates a418. Próximos passos são restauroROOT, publicação/CI/revisão/merge da PR419 e retomada coordenada das dependências.
