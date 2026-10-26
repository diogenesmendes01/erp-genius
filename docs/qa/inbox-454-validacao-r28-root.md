# PR #454 — evidências independentes do commit público

### PR #454 — validação independente da decisão de documentos, R28

Fonte pública dd449ac executada no TESTER com cliente próprio499 e banco descartávelT500: oito arquivos completos de integração38/38, focal6/175, TypeScript original, unidade global1078arquivos/9623testes e lint0erros/57avisos, todos com terminais0. Build original também passou com heap8GB herdado pelos workers; o OOM anterior do worker4GB foi preservado e não é resultado aprovado. Banco restaurado1445 antes dos gates globais. Nenhuma fonte/config/asserção foi alterada para obter aprovação. Este filho acrescenta somente documentação; os testes mantêm atribuição à fonte dd449ac. CI e aceite visual pertinentes à base conservam seus gates. Registro: docs/qa/inbox-454-validacao-r28-root.md.

Relato transcrito com LF e sem espaços finais; o artefato original permanece preservado com SHA256 85d4d1c6cf682e9e574d891c8dbc8ed97acd206474649048cfe8941b7fca785b.

# QA independente454 — fonte pública dd449ac4299ed793c8c7cff85849a978b8c4ccd4

Recorte nativo autorizado concluído:8arquivos completos,38/38 testes, todos com saída terminal código0. Não é suíte global, homologação visual, execução da fonte privada274170a6 ou conclusão da PR.

Preflight ea5a89 EXIT0:HEADdd449ac e diffHEAD vazio.17paths selecionados já conferidos por objetos Git contra o candidato; nenhuma alteração de fonte durante esta execução. Perfiltester SHA5b0926e5b01feb50b0c9ede29cdd69eb124c2f563ce20937409d34991722bfcc; cliente OWN499 schema SHA dfbdd818cc0c45a2aa936691f765e726da8537713443a16788983f9d0160ddaa. Schema físicoCRLF2972556640abaec8aced4c21cab10036c016245742432b0469433b727c89501d, normalização Git sem delta. Não tratar rawCRLF como divergência da fonte Git.

ROOT preparou fonte/cliente/Nexttypes/quarentena e auditou o banco TESTER500:497migrações/426tabelas/1445baseline, sematividade/listener. O banco é superset da fonte499, sem501502; nenhum campoOrigin500 é necessário pelos casos. O cliente499 foi gerado no próprio T pelo ROOT, sem copiar clienteA. TESTER não gerou cliente, aplicou migrações, alterou perfil, instalou dependências ou executouDDL.

Configuração original vitest.integration.config.ts, HermesNode heap1024, maxWorkers1/no-file-parallelism, UTC e sete provedores vazios antesimport, fetch bloqueado. Bootstrap histórico inbox-372-4eaa-tester-bootstrap.mjs valida owncwd/perfiltester e URL54329; nome não fixaHEAD4eaa. Setup original executa somente prisma migrate status, sem deploy. Cada arquivo teve seu próprio comando/processoCLI; mesma sessão acompanhada até terminal. Sem filtros, skips, retry, patch, novo exclude ou mudança de timeout.

| Arquivo completo | Sessão → terminal | Resultado | Duração |
|---|---|---|---|
| src/server/crm/pessoa-cadastro-validacao454.int.test.ts |40645 →37ff05|5/5 EXIT0|26.40s|
| src/server/crm/pessoa-cadastro.int.test.ts |71110 →46d284|7/7 EXIT0|32.15s|
| src/server/inbox/painel-cadastro-pessoa.int.test.ts |34413 →1f68f6|5/5 EXIT0|23.19s|
| src/server/inbox/pessoa-cadastro-concorrencia.int.test.ts |23368 →fdd067|8/8 EXIT0|39.03s|
| src/server/inbox/pessoa-cadastro-notify.int.test.ts |40500 →c7ca53|3/3 EXIT0|15.90s|
| src/server/inbox/pessoa-cadastro-pool1.int.test.ts |45410 →b22948|3/3 EXIT0|15.05s|
| src/server/crm/pessoa-cadastro-redacao.int.test.ts |1466 →df4fc8|3/3 EXIT0|14.82s|
| src/server/crm/pessoa-cadastro-cache.int.test.ts |63985 →c3ed70|4/4 EXIT0|23.16s|

O novo5 exerce CRM/Inbox:validador conhecido inválido e101caracteres recusam semPessoa/Event/logPII, histórico inválido reapresentado é recusado, omissão/DOB-only preserva legado, seis formatosLATAM válidos/inválidos, unknown100/null aceitos e guestCRM negado. Sete arquivos legados são recortes completos distintos; pool1 não equivale a prova universal de ausência de escape global. A tentativa DEV antiga393ab0 não pertence a esta execução nem é somada às38aprovações.

Redação: artefato realmente produzido output/inbox-340-redacao-canais-855372-private.json, preservado byteigual como output/inbox-454-dd449ac-redacao-curated-tester.json. Dois canáriosPrisma geraram emissão real no canal log, emissaoRealPreservada=true. Nenhum logger foi silenciado para obter sucesso. O teste exige ausência dos valores sensíveis nas falhas de cadastro. Logs completos próprios output/inbox-454-dd449ac-native-{validacao5,crm7,painel5,concorrencia8,notify3,pool3,redacao3,cache4}-tester.log.

Warnings de configuração:MIXED_EXPORTS e recomendação vite-tsconfig-paths; nenhuma falha. Pós-execução f4e944 confirmou diffHEAD vazio. SQL/Node dos testes encerrados e lease liberada imediatamente ao ROOT após38pass. ROOT deve restaurar snapshot1445 via restorer temporário client499 antes de globais; TESTER não executa restore. UNITfocal175/TSC/UNITglobal/lint/build ainda não executados nesta fase, aguardam GO. Fonte/cliente/perfil não serão restaurados pelo TESTER semcoordenação. Sem commit/push/merge/fechamento deissue ou integração externa.

## Gates sem SQL após restauração ROOT46688b

ROOT confirmou restauração TESTER500/1445baseline e autorizou os gates na mesma fonte dd449ac/clientDF. Os seis arquivos focais foram confirmados nos artefatosDEV:src/server/_shared/validacao.test.ts,crm/pessoa-cadastro-escrita.test.ts,crm/pessoa-cadastro-schema.test.ts,app/(app)/inbox/abas/GavetaContato.test.ts,app/(app)/contatos/FichaContato.test.ts eapp/(app)/inbox/abas/form-contato.test.ts. O último é controle preexistente, não um arquivo omitido por alteração de escopo.

| Gate | Sessão → terminal | Resultado |
|---|---|---|
| UNITfocal6 completos, original/w1/1024 |e2e9da|6arquivos/175testes EXIT0,2.66s|
| TSCoriginal --noEmit --incremental false/8192 |6265 →d8be46|EXIT0 semdiagnósticos|
| UNITglobal inteira/config original/w2/1024 |1403 →2eb560|1078arquivos/9623testes EXIT0,275.02s|
| Lintglobal original eslint ./1024 |41857 →b4f6e6|EXIT0,0erros/57avisos|
| Buildoriginal next build/Turbopack/pai8192 |57561 →0523b1|EXIT1:workerTypeScriptOOM perto4GB|

UNITglobal não recebeu filtros ou exclusões novos; include/exclude originais preservados. Nenhum skipped foi informado no resumo. Focal175 é subset do global, não somar aos9623. Os logs de captura dos controles UNIT do CLI visual são doubles e não homologação de PNG/browser real. Lintinclui avisos históricosoutput e fonte; semfix/limiar de warnings novo.

Build foi autorizado explicitamente depois dos quatro gates0. Wrapper privado output/inbox-454-dd449ac-build-bootstrap-tester.mjs valida owncwd/perfiltester, configuraUTC/seteprovedoresvazios/DATABASE_URLmocklocalhost:1 e globalfetchthrow, então importa CLI localnode_modules/next/dist/bin/next com argumento build. Nenhumwebpack/skiptypes/configedit/install. O fetchguard é do executorharness; não é prova universal dos workersfilhos. Next16.3.5 compilou em17.2s e iniciou seu TypeScript; o workerPID876320 terminouFATALheapOOM comGC4048–4050MB. O comando pai tinha8192, mas o worker observado esgotou cerca4GB. Não houve diagnóstico de erroTypeScript de fonte. Esse limite observado é falha real de build ambiental, não sucesso; relatório não chama todosgatesverdes.

STOPimediato aoexit1, semretry/correção de fonte/test/assert/config. ROOT informado para avaliar eventual propagação deheap aos workers, seautorizar nova execução original. Artefato output/inbox-454-dd449ac-build-tester.log preservado, assim como .next gerado parcial. Não excluir/alterar para ocultar a falha.

79d0ba confirmou HEADdd449ac/diffHEADvazio/perfil5b/clientDF/mig499b108 inalterados após os gatesanteriores. Logs adicionais output/inbox-454-dd449ac-unit-focal175-tester.log,-tsc-tester.log,-unit-global-tester.log,-lint-global-tester.log. Artefato redação SHA04fc61fcbf7837eb84eae8639d198cf2fe8b8aa35417de4d9b965f4d645ba7ee conserva emissão real/canaislog dosdoiscanários. SemSQL desdeRESTORE46688b, semrestore deHEAD/cliente peloTESTER. Build e CI/visual finais pendentes.

## Retry único do build autorizado pelo ROOT

Depois do STOP0523b1, ROOT autorizou exatamente um retry sem alterar fonte/configuração, propagando somente NODE_OPTIONS=--max-old-space-size=8192 aos workers além do heap8192 daCLI. Invocação PowerShell temporária no processo filho; nenhuma variável persistente do worktree alterada. Mesmo bootstrapprivado, NextCLI build original/Turbopack,UTC7blank/mocklocalhost:1, semwebpack/skiptypes/mocks/assert/configedit.

Execução862345/sessão73753 acompanhada até terminal25e7f6 EXIT0. Compilação2.5s, TypeScript do Next concluído73s, geração115/115páginas com31workers e finalização concluída. Log próprio output/inbox-454-dd449ac-build-retry8192-tester.log. O terminal0523b1 e seu log negativo permanecem preservados; a aprovação é desta tentativa nova, não reclassificação da anterior. Limitação de preservação comunicada ao ROOT: .nextparcial foi reutilizado no retry, sem cópia separada do diretório préretry; não alegar snapshot independente daquele parcial. .next final fica preservado para o integrador.

Resultado atual dos gates autorizados na fonte pública dd449ac:38/38nativos completos em8arquivos, focal175 em6arquivos, TSCoriginal0, UNITglobal1078/9623, lint0erros57avisos e buildoriginalretry0. Focal não se soma ao global. SemSQL após restauração46688b; semexecuções de banco ou geraçãoPrisma peloTESTER. CI remota, visual real e homologação de produto permanecem etapas próprias; não fecha PR/issue nem presume conclusão340. Não restaurarcliente/checkout ou retomarSQL semGO ROOT.
