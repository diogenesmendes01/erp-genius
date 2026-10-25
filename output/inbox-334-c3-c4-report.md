# PR444 R1 C3/C4 — relatório DEV B

Branch codex/inbox-e2-334-review-c3-c4, pai PRIVADO76f9a62864844fee4bcc8bf786b42666e283c5af. Esse pai contém APENAS schema/migrationgrant494 de checkpoint local sobre0160; ROOT deve integrar SOMENTE o delta deste commit na PR444, sem publicar/checkpoint nem copiar árvoreB. Nenhum push/PRDEV.

## Alteração

Novo historico-aria-leitura compartilha autorização/contexto, filtro por Pessoa/CRM, paginação keyset100→30 entre contador e módulo completo. Header troca import/call sópara carregarContadorAtividadeAria. O completo mantém versão publicada/parse estrito, última1, decisões/desfazer e mesmoDTO. Sem countSQL global: DESFEITA ocupa a janela30, contador soma apenasEXECUTADA/APROVADA. Semconfig/padrãonovo/trycatch de parse no contador; foraACL0. Db explícito inclui scope/lead/actions na mesma conexão; default mantém chamada2args histórica.

C4 somente4 valores de ALTERACAO_ARIA_LABEL: Preencheu um campo/Adicionou uma tag/Moveu a etapa/Criou uma tarefa. ACAOlabels neutros literais; textosPreparou resposta/documento e específicos comnomes permanecem. Nada de inferir entregaexterna/expôrID.

## TDD e gates reais

- C4RED00a0cf EXIT1,1fail12pass: fallbackaindainfinitivo.
- C3UNITRED22208e EXIT1,2fail3pass: configuração inválida fictícia atingeHeader; controlefullreject e ACLnegada passam.
- NativeRED sessão14776/636807 EXIT1,10completos2fail8pass,44.59s: ConfigAriaSchema.parse REAL lança por publicação fixture inválida emHeader ePainel. SHAlogaa8d0cf9b63b927d628fc89ff8fd5c7be14aa64d052f06cd5cf526b840440bcc.
- NativeGREEN MESMO arquivo painel-atividade-aria.int.test.ts completo sessão85994/89a8da EXIT0,10/10,47.15s. SHAlog052ed3f407ce5f1a9d26e20c1d419975e2e25919a000c77aa7d67d7f25985b7f. Casosoriginais7 preservados (105ocultos+31visíveis, Pessoa/CRM, configuração completa estrita, semlead/convite);3novos Headerinválida+fullreject,Painel/podeEnviarbaseline,30DESFEITAocupamjanela. Não exercita envio/driverexterno: sóleituras/fixturesDB.
- UNIT94717/1961c3 EXIT0,3arquivos161casos (contador5/texto13/enums143). Counter1açãofindMany/0versão/0decisão/0última conferidos em mockDB. Não alegar1SELECT SQLTOTAL: ACLs/transitivos e lotes dependem de dados.
- Focal inicial2556/12462a EXIT1,1fail104pass em cliente-voltou:21. Contraprova98fe43 EXIT1 1fail15pass no arquivo COMPLETO com leitoresORIGINAIS76f9; depois fontesrestauradas byteiguais. Failherdado, não causadoC3.
- Candidato de fixture mockcontador produziu a6f0740, mas foi REJEITADO como solução e removido. Não usar essa execução como gate final.
- Carry de asserção linha21 LITERAL ROOT57822fc28c3b1a0e8b7e1a8ba8aa6c264fce1871: leituraautorizada exatamenteuma2args, nunca envioargs[2]true, contador0 e Pessoa/Comercial próprios. Não atribuir autoria desse fix ao C3. Zero mock do contador final. Defaultfactorycall2args compatível com antigo; Dbexplícito4args.
- Focal33337/fb0685 EXIT0 11/105 apóscarry real; finalcaf8e4 EXIT0 11arquivos106casos apóscontroleDb explícito. Inclui6arquivosUI PainelContato/AlteracoesAria/ResumoAria/AbaAtividade,4backend e guarda paginacao-dois-sentidos COMPLETA. Sem filtros de caso/skips; não global.
- Lint12395e EXIT0 sobre9SRC,zeroavisos antesúltimo testeDb; lint final será registrado no freeze. Sourceproof37baf272b21c444aa9341ae1ad7fd6d76578f56b948efbc06d8847f181a85a7f prova leitura literal predecessor com transformações db-aware/empty null, preservaçãoACL/ConfigSchema/versoes/decisão/global/schema. Depois disso sótesteDb+docs.

NativeGREEN ocorreu antes de adaptar chamada default2args para fixtureRoot; semântica false/prisma exatamentea mesma, versãoTx4args mantida. Finalfocal prova assinatura2args real eDb explícito; não repetirSQL semlease/coordenar. Nenhuma alteração de política/leituraSQL apósgreen além de formaequivalentedosdefaults. Quebra de tipos/gatescompostos ainda dependeROOT.

## Ambiente, isolamento e banco

Config integração ORIGINAL, perfilci-integracao, UTC/w1/heap1024/no-fileparallel e7providersvazios sóexecutor. Client383782975cb5cd3b979559a2a48eea4ad47ce92913098387a089ca6f3e9a34ef. Schema grant494 foi aplicado SOMENTE ROOT: contagemREAL493migrações425tabelas, semInsightsA493. Não alegar ambiente492 ou perfilcomInsights. Admissãoa0cdc60:493/425/0outros. Liberaçãoff859e0:493/425/0outros, fixtures presentes; receiptc922ad11bb7136bb085757ff333eeebb460abe571fc49e865290523315c4e7e4. ROOT restaurouf020fe EXIT0/425hashes/baseline504. SemleaseSQLagora. Nunca usar restorer492nesseB.

370WIP preservadoANTESisolar: output/inbox-370-before334-manifest-private.json SHA17b68d640a581b371a6a1ece24ff4ffac99a4436d416fe8289de33d5363cbde4;19SRC backupsTXT byteiguais; stash78d35dbb373cb55d3fbafc9db023c7dea18b2188 NÃOapagado, recuperação porHASH; checkpoint76f9 só2schema paths. Sem alteraçãoACL/grant bloqueada/implementaçãokernel370. A pergunta humana específica permanece pendente, não inferiraprovação.

## Riscos/pendências

Redução estruturalHeader: deixa de pedir páginaúltima1, versão1 eD_decisão; mantém B+P_hist transitivos. Não medir tempo/custo totalconstante porUNIT; histórico oculto pode exigir múltiplos100, autorizaçãoantes30 é intencional. O módulo completo ainda pode falhar porconfiginválida, como contratoestrito; o painelbase não depende mais disso. Sem novaAPI/cacheglobal/fetch/poll/SSE/schema/package/config/install/DDL/generate/HTTP/browser/externos.

QAexata/TSC/global/lintoriginais/build de composição peloROOT e visualC1Atividadegerente/vendedor continuam pendentes. Essa revisão não fechaC1/C2/C5nemD5/#370 nemhomologa aPR444 porinteiro.

Lint FINAL9add31 EXIT0,9SRC/zeroavisos. Focal finalcaf8e4 11/106 EXIT0; schema/cliente/configs protegidos no freeze.
