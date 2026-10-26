# QA DEV #376 — gates locais e histórico preservado

Resumo autoritativo final do DEV: runtime3ddc3de04dc165e0a94cb58a2ff50c02bfad524d; checkpoint nativo10/10 EXIT0 (41651/272572), regressão nativa17/17 EXIT0 (19224/278a1c), executados em série. Focal114 e lint12SRC0 da mesma implementação, sem TSC/global/build/visual DEV. QA independente e gates originais compostos pendentes. Os blocos “antesSQL” abaixo são históricos datados de cada freeze, não o estado final.

Fonte sobre2770e817; branch codex/inbox-e4-376-presenca-classificador. Integrar apenas delta376; paisprivados/grant não publicados porDEV. Semhomologação/nativepresumida.

## TDD e resultados reais

- Classificador scaffold:32028/7ec288 EXIT1 11falhas9pass→59846c EXIT0 20. ROOT achou cleanup tardio offline→online; REDpróprio cb1c0f EXIT1 7falhas20pass→8c9fc1 EXIT0 27. Close sódesliga semcontato novo; ROOToráculooriginal replay394d74 EXIT0 informado pelointegrador. Negativos preservados, primeiros20 não provavamfix.
- Validadefoto c4ce60 EXIT1 4falhas15pass (scaffoldnull)→purosac8bab EXIT0 2/46. Monotônico, latencydesdeinício, TTLinválido/missing, semdata civil.
- Parser a14bcf EXIT1 15falhas6pass contra scaffoldany; binding0b9787 EXIT1 1falha21pass; final22. Header/tipos/seqBigInt/strictpayload/authorigem cobertos. Nãoatribuirnegaçõesscaffoldthrow àprodução.
- Writer f1ae75 EXIT1 5positivosfaltantes31pass nos2arquivos(scaffoldthrow), finalb6c398 EXIT0 2/36. Doubles comprovam ordem/chamadas/intenção do código, NÃOlocks nativos/pool1.
- Reader281e80 EXIT1 7falhas→807255 EXIT0 2/15 incluindoregressãocarga3718. ContextoPessoas extraído literalmente comdbopcional; sourceproof comprova transformação eprotegidos.
- API6ebea1 EXIT1 6falhas8pass→dbe7e1 EXIT0 2/28 inclwriter14. Headers/config/payload/auth anteswrite; nãoHTTPexterno.
- Lifecycle111a70 EXIT1 8falhas2pass; primeiro002832 EXIT1 atividadecoalescidaperdida durantepulso; corrigidafila booleana semtimerextra→de22c7 EXIT0 10; adversarial58e5af EXIT0 13. BadgeforaInboxzeroPOST, StrictMode, cleanup/reconnect, seq, snapshotoldA→B, latência, errosemloop. SSEOPEN é autodeclaradocliente, limitação explícita.
- UIradio2c79e3 EXIT1 1falha9pass→bfe476 EXIT0 7/174 comInboxNovo.interacao, fotoopcionalnãoaltera contexto/payload. Hook/consumidores14110d EXIT0 5/75; InboxNovo.interacao usa mocknominalusePresencaInbox porque seu harness testaoutrasresponsabilidades; hookreal e brokerreal têmtestespróprios.
- Guarda2ff102 EXIT0 2/12, nominal2timers e8mutantes+outromódulo; sem parserexceçãoampla. Alteração de guarda documentada, não “literal”.
- Focalfinal session98663/5f75e2 EXIT0:17arquivos192testes, UTC/w1/1024/no-fileparallel, completos semfiltros/skips. Recortes acima sobrepostos, NÃO somar. Lintprimeiro0e177f EXIT1 umareatribuiçãodefixtureduranteReactrender; movida paraeffect. Lintfinal626d46 EXIT0 27SRC, stdoutESLintvazio.

## Native preflight — pendente, NÃO executado

src/server/inbox/presenca.int.test.ts completo:17casos finais (16declarações, umaeach2). Primeiropreflightestimou17 antescleanup porcontagemmanual incorreta; númeroautoritativo apóscoleta seráterminal, semfiltro. ImplementaçãoAPI/writer/reader nativa, sessãoAPI mocksomenteauthboundary; SQL/ACL/Prisma/FKs nãomockados. Cases entrada/replay, reconexão, pulso/interaçãoexpired, closeexpired, multiabas, limite8concorrente, retenção/newID/geração1oldopen/pulso/close, selfbinding/seq, candidatos/permissões, autorrevogadoemUserwaitobservadopg_blocking_pids, clockpóswait, pool1, FK/checksnominais, APIorigem e cleanup24h lote16. MedircontadorPrisma/raw no leitorsobreadmissão; uma leituraPresenca.findMany não significaumaSQLtotal. SemEXPLAIN adicional: baselinepequeno não justificaria inferência escala/índice.

## Infra, pins e pendências

Schema3191506a93d4df768ac92031d622bd3cec04dae1ca073b9961b64295360f9728 e SQLde580804e22f47e9ea2acb1a26c5d64c31a2da6b84e4b897f6fe634dcdd9af53 congelados/aplicados apenasROOT. Client3bafe670c32e16fa996f026cc5671f08ba7779838a329fc0501f53cd4f82bee0; ROOTready059f97 EXIT0 e snapshotd80980 EXIT0,505linhas/426hashes, contagem494migrações reais. OriginalsnapshotSHA67971b4cf22bf10826d07048ec7f3fa0ffa321aeca588bff529d528da69b3dc6. LeaseSQL aindaNONE; nenhumexecutorBativo. Perfil/config/package/pins intactos; semgenerate/install/DDLDEV/build/TSC/global/browser.

SSE/AvisoInbox, escopo/permissões/grant370/kernels/distribuição literaisparent. Provaoutput/inbox-376-sourceproof-private.json. SharedInboxNovo novo hook/captures e radióstatus somente; ROOTfix447 de callback nominal seráunido pelointegrador, não copiado. QAindependente, nativelease/replays, gatesoriginaiscompostos e visual600/60/mobile/temas pendentes; falhapresençanãobloqueianegócio. Não marcar376ouD5concluídos.

## Filha hardening pré-native de4cbf67e1

RED561c0d EXIT1 2falhas27pass/29: findFirstselfbound ausente e atividadecoalescida retidaaté pulso. GREEN00e2f0 EXIT0 4arquivos41casos (writer15+lifecycle14+guard12), semfiltros/UTCw1/1024; lint4SRCd8232b EXIT0. Produção sópresenca-escrita.ts e presenca-inbox-cliente.ts; schema/SQL496/testenativo/SSE/ACL intocados4cb. O focal17/192 continua evidência do pai, nãoatribuirautomaticamente àfilha. Native17 completo ainda pendente delease. Negative561c0d e4cb congelados preservados.

## Filha revogação de dff237ab, antes native

TRO4cb encontrou catches que degradavam/ignoravam401/403/404. REDbroker62615/fd68bb EXIT1 9falhas16pass/25 e REDAPI0b46e1 EXIT1 3falhas14pass/17 preservados. GREENsession44545/0bb02f EXIT0 5arquivos61casos, mesmosarquivoscompletos/UTCw1heap1024/nofileparallel; lint5SRC8336df EXIT0. Casos cobrem interacao/pulso/ler ×401/403/404self,404modal explícito semheartbeatconsulta posterior, snapshotantigo apósrevogação e APIerroFoto versusauthreal. Produção3paths: broker, API, reader; writer/schema/SSE/testenativo literaisdff. CheckpointCASself retido como ponteiro inerte, nãolease, conformeGO ROOT. SQLDEV continua nãoexecutada, native17pendente; não atribuir aohead novo os192focais doancestral.

## Preflight tipado antes da PRIMEIRA SQL

Por orientaçãoROOT, filha exclusivamente testes substitui catchfalse genérico de revogação por resultado/erro guardado e exigeErroPermissao. Atorinativo exigeErroAutenticacao; capabilitycontexto exigeErroFotoPresenca; TTL/bindingsvelhos exigemErroPresenca. Positivos, counts de rows e efeitos preservados. Mesmoarquivo completo17casos aindaNÃOexecutado. Pinraw7982971e histórico nãoéRED; reconciliaçãoEOLf15→798 comprovada porreconstruçãotailCRLF/LF eGitblob7fcc6a6b, relatóriooutput/inbox-376-native-pin-reconciliacao-private.json. Runtime/schema/clientSSE intocadosd8e. ContadorPrisma/raw explicitamente não étotalSQL; nenhumEXPLAIN/eventqueryexpandido.

## Primeira SQL real e correção clockTZ — GREEN ainda pendente

Fontec044/nativeee6c, sessão59147/6462a4 EXIT1:17casos12pass5fail em76,95s, logSHA6689a434e973f83f113d35fc41ec92cccd7bbf78f72e18aebdba08ac2b755640. Falhas reconexão, pulso/interaçãoexpirados, closeexpirado ecleanup24h. Nãofoifalhadefixture: clock_timestamp()::timestamp(3) perdiafuso eadapterdevolvia Date3hatrás, quebrandoTTL/CHECK/retention. Tipificaçãonegativa evitou falsegreen deinfra.

ROOTcontroleRO4926e8 EXIT0, output/inbox-376-clock-ro-adapter-root-private.json: PGTimeZoneAmerica/Sao_Paulo; aware01:17:38.962Z versus naive22:17:38.962Z, delta-10800000ms; timestamptz(3) eUTCnaive preservam epoch (<1ms). Escolhido tipoTimestamptz3 no raw dewriter/reader eholderfixture. Zero alteração de schema/SQL/DBTimeZone/env. Fontecorrigida NÃOalegaGREENaté replay17completo. B496restauradoROOT4926e8 baseline505/426hashes/mig494, leaseNONE.

ExecuçõesNode/SQLpausadas enquantoROOTbuild; filhaFScongela2helpers+holder+docs, negativos preservados. Próximolease/replay17 eQA/gates/visual pendentes.

## Replay nativo GREEN e filha cliente pending-open

ReplaySQLsession81001/6f2203 EXIT0:arquivoCOMPLETO17/17 em73,03s, originalintegrationUTCw1heap1024/7blank/nofileparallel/semfiltros/skips, fonte434/native28c317 congelados. LogSHAd6e430ac1518aea6d7d14e9db97b5243d855805ef5b0c8412f5404764e67c4a5. Releasef07c7aecc216fd82f7154f639cce2bad178ef57e61897cec0d2069795d950229; ROOTrestaurouB496476af1 EXIT0,426hashes/mig494/baseline505. SemSQLextra/leaseNONE. NativeGREEN cobre servidores434, não éQAvisual/homologação do cliente.

TROhipótese reentrar antesACKabrir confirmada RED98bb87 EXIT1 1falha25pass/26: registropermaneceu gen1fechado. Flushfixo15microtasks era insuficiente apósnovoencadeamento; harnesspassou a drenar scheduler comadvanceTimersByTimeAsync(0), mantendoasserções. Contraprova434 comessemesmoharness1c83d4 EXIT1 1falha25pass, semenfraquecerRED. PatchreservaPromise poruser/aba, C2aguardaCAS e abrepróprio ciclo; canceledintermediário nãoquebrachain/finallyantigo nãoapagareserva nova. Rejeições401/403/rede não geramNULLupsert/timerloop; casosA→B→A/múltiploscleanup/abasdistintas cobertos. Controleaba achoucheckpointarmazenadosóporuser: REDb721a8 EXIT1 1falha31pass; chaveagorauser+aba eACKantigo não sobrescreveoutraaba.

Final39c2fd EXIT0 10arquivos100casos (lifecycle32+guard12+hook2+transferir54); lint2SRC243a44 EXIT0. PrimeiroGreen696e18 teve2falhas porharnessflushantespulso, preservado; nãocontarcomoaprovado. ProduçãoSÓbrokercliente, maisseuteste e3docs; helpers/server/schemaSQL/client literal434, portanto não repetirSQLpor essafilhaUI. Sourceproofpreserva esse limite. NovaentradaDELIBERADA apósACKperdido/rejeiçãorede ainda éinvestigação técnica pendenteROOT, nãoalegar recuperação completa nemencerrar376.

## Resolver mínimo autorizado — freeze antes nova SQL

Sobre f3d80dd6: parser/helper RED2e75ce EXIT1 5falhas23pass (scaffoldnull); GREEN07587e EXIT0 3/45. API+broker RED48322f EXIT1 5falhas49pass; GREENe2c3ee EXIT0 4/66. Focal final a25c14 EXIT0 7arquivos114casos completos UTCw1heap1024/nofileparallel, semfiltros/skips, com resolver/strictpayload/lockorderfresh/CAS/401403/cleanupantesACK. Registros anteriores sobrepostos não somar. Lint12SRC4bdeba EXIT0 zeroavisos; primeira805f74 EXIT0 continha1warning de fixturecommaexpression, corrigido semconfig.

Caracterização replayexato cb99a9 EXIT0 writer17:2novos casos expired/closedexpected409, nãoRED deproduto. Resolver retorno é sócheckpoint|null, metadadoSELF user+aba; freshUser helperextraído literal do writer (nome/export), backend reader/colegas/escopo/SSE/Schema/config intocados. Sourceproof output/inbox-376-resolver-sourceproof-private.json SHAe7b33dbb89b89e01e7712b9b6675f4ecb7dba438d2c16c77487415d26cc2fc20. Clientflag possuiAbertura impede tratarcheckpointcomolease. Interval não chama abrircausaentrada; falha de registro corrente encerra esse ciclo, semauto resolver. Novo modo não concede nenhumgrant/escopoCRM.

Preflight pendente: presenca-checkpoint.int.test.ts COMPLETO10casos (8declarações,2each2): null/ausênciaUser; ACKperdidoTTL/fechada→metadata rowbyteigual→newgen própria+pulso; outroUserABAconhecida; inativo; Portalrevogado emUserholder pg_blocking_pids; corrida gen/novoIDABA depoisresolver semoverwrite; APIreal self-only; pool1/zeroefeitos. API usa mock deauthboundary, SQL/ACL/roles/fresh/locks nativos. Em seguida presenca.int.test.ts COMPLETO17casos, justificado pelaextraçãofresh e novo protocoloroute. Uma suíte por banco, futurasessões/terminais registrados apóslease. NÃOEXECUTADOS ainda; native17 anterior434 é histórico, não gate novo.

B496continua snapshotROOT476af1 baseline505/426hashes/mig494/client3bafe; leaseNONE. Sem SQL/DDL/install/generate/env/deps; #370bloqueado e stash preservados. QA independente, novosnative/gatescompostos/visual pendentes; nãohomologar376.

## Resultado final dos natives na MESMA fonte3dd

- Checkpoint arquivoCOMPLETO10/10 EXIT0, sessão41651/terminal272572,44,25s. Logoutput/inbox-376-checkpoint-native-private.log SHAb73ecae8ec5e82602dc867ebc977255402dcf46d7ea1ae4df9538c3888d915c5.
- Somente após terminal0, regressão arquivoCOMPLETO17/17 EXIT0 em NOVA sessãoSERIAL19224/terminal278a1c,72,19s. Logoutput/inbox-376-resolver-reg17-native-private.log SHAa3483982fbe4bb14c286d641ade6a2c87b9bc7d4ea8572a2a47f8692dafdb14a.
- Originalvitest.integration.config/UTC/w1heap1024/no-fileparallel/seteprovidersvazios, sem filtros/skips. 10 e17 são dois recortes distintos; não somar históricos ou chamar suíte global. Nenhum provider/RPC externo ou envio de negócio acionado.
- Os testes novos comprovam checkpoint|null sem mutação (inclusiveupdatedAt), selfbinding por usuário+aba, revogação causal tipada sob holderUser/pg_blocking_pids, races geracional/novoIDABA semoverwrite e nova vida exigindo abertura+pulso, pool1. Regressão17 comprova critérios anteriores com helperfresh extraído e novo protocolo presentes.
- Fonte3dd permaneceu congelada durante ambas; pinsnative72fd5c/28c317 e schema319/SQLde580/client3bafe/perfil/config intactos. LeaseSQL/Node liberados após segundo terminal; recibooutput/inbox-376-resolver-native-release-private.json SHA191e07da330af7ed9d85a42d275dd1a74bd9557f9612bfd9642f47e1087e82a3. Fixtures ficaram no B; não presumirbaseline505 antes confirmaçãoROOTrestore.

Fonte final documental será filha de3dd com runtime literal. GatesTSC/globalUNIT/lintoriginais de composição, build/CI e visual/perf de presença continuam para coordenaçãoROOT/TESTER; não declarar376homologada. #370 permanece sem autorização de grantcore e sem escopo novo.
