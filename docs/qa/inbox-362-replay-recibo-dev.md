# #362 — revisão R3B1/C2 DEV

## Estado atual — revisão completa C2–C6 antes da composição final

Fonte local00a8a330/Main960 com delta C5 core RAWc2c608ab1cc2119798c383aac88d66f3d2bd0ef9e4c6810f1600e5c613ca666f. UNIT118/7arquivos (1c9171 EXIT0), lint3TS/c455b3 EXIT0 e TSC8192/ebd91d EXIT0. Nativos na MESMAfonteC5: legado10fd1bde/sess34528→2fc331 EXIT0,10/10,37.52s; operacional16bf6e8e/sess45742→d1b0f6 EXIT0,16/16,60.99s. Log10SHA16d8b46d2c981ba172d80c0a242f318bd9be83fbd47428b38303b250e1f6aa89/log16SHAdea4bdc16a8475d520114ee442d3c479934f224f41c86949f188412ea7f64c40. Mais C2concorrência22ef92 EXIT0,2/2 na mesma fonte: total atual28 casos distintos/três arquivos, sem somar execuções anteriores.

C2: ACKsemConfigDML e hipótese de lockglobal da singleton existente não reproduzida (Prisma5.22, SQLsóSELECT, BantesliberarA, ACK0queriesConfig); inicializaçãoausente não medida. C3mapanominal abaixo; C4índiceIDs501502aplicadasimutáveis; C5textoagendar/alterar comRED→GREEN; C6decisõesD11GP+ACK esclarecidas. Nenhuma alteração especulativa da ordem de locks. Global/build/QA pública exata/CI e interface363 continuam PENDENTES; não fechar362. Todas as seções seguintes conservam fontes/negativos intermediários e não revogam este estado atual.

## Histórico — fonte inicial R3B1, antes de C5 e da medição C2

Base local ae0cd807f228215b4b9beccaa04f721cc027bda3; porte D11 sobre MAINd95 com D10 preservado. Schema/client0084/perfil dev-gravacoes/pacotes não mudam. Não é QA independente ou conclusão da issue.

UNIT original completo: 50bfb9 EXIT1 RED33 (17falhas assertivas/16controles); d4e81a EXIT0 GREEN33; 8afaeb EXIT0 regressão sete arquivos115 casos, sem filtro/skip. Dois asserts antigos de replay foram corrigidos conforme contrato #267: responsabilidade e ENVIANDO não invalidam próprio recibo. Novas mutações ENVIANDO e perda de leitura/sessão continuam recusadas. Admin pode recuperar seu Evento referente a intenção de outro autor.

ACK valida Evento/agregado/hash/operação/intenção e leitura canônica fresca após locks, sem ConfigIA.upsert ou DML. Caminho de nova mutação não foi reordenado. Não há promessa de linearização global de ACL. C2 restante exige medição concorrente, não otimização especulativa.

Autoria nativa: arquivo operacional ampliado de13 para16 casos; troca do antigo assert de Assumir por transferência+leitura mantida, adicionados ACK optout/closed/claim sem DML, leitura revogada durante espera e Admin sobre intenção de vendedor. Executado depois da lease ROOT, conforme resultados abaixo. Legado10 inteiro intocado; nenhum preview ou suíte concorrente no banco durante as leases.

Na fase inicial, TSC/lint finais e hashes ainda aguardavam terminal; os resultados posteriores constam abaixo e no estado atual. Histórico RED público2147c8 (9pass/1optoutfail no legado10) permanece atribuído à fonte anterior; os79 históricos não substituem regressão do legado nem testes deste delta. R3C3/C6 documentais não autorizam filtro de origem exclusivo nem alteração de migração aplicada; preservar contratos existentes e SQL501/502 imutáveis.
Gates finais desta fonte: UNIT 4ac9dc EXIT0 sete arquivos115/115, sem filtro/skip; lint477d34 EXIT0 três TS, zero avisos; TSC original8192 1ef234/sess11454→09fb9e EXIT0. Negativo TSC5bf2ef/sess11438→eee975 EXIT2 preservado: variável de teste e enum nominal inexistente, corrigidos na autoria para DESPACHADA real antes dos gates finais. Nenhuma mudança de schema. Diffcheck0, staged vazio. Legado10 Git12152ab4ba1f4d5fa24180ae9f35fb6170f8a0e5 intacto. Essa etapa offline não executou SQL ou captura visual; as leases posteriores constam abaixo.
Aceite nativo DEV sob perfil dev-gravacoes/config original/Hermes1024/UTC/sete provedores vazios/w1/no-file-parallelism, arquivos completos sem filtros/skips/retry: legado10 72c85b/sess48360→a66ddb EXIT0,10/10,38.05s, fonte RAWbe575d0f/Git12152ab4 intacta. Primeira execução operacional b67d47/sess7438→76fdb0 EXIT1,14pass/2fail,59.72s: ambas falhas de preparação antes do ACK,23514 fechamento sem statusENCERRADO e42P01 nome lógico Oportunidade em SQL. Não são RED de domínio. Log e fonte d15a7c preservados. ROOT restoredf82be antes de autorizar duas correções exclusivamente de fixture, sem alterar asserts/core: statusENCERRADO coeso com encerradoEm e tabela físicaLead.

Nova fonte nativa e20f5d03:55b01b/sess59933→f5c95e EXIT0,16/16,60.71s(tests58.32s). Log SHA0a955e9186db9358e689fff3474baee0b60098f8893d3d8d060c9ef0b27ccbb4. Casos antes não alcançados agora passaram: ACK após optout/fechamento/claim sem DML e perda de leitura após espera com mensagem canônica exata; transferência preservando leitura e Admin recuperando seu Evento sobre intenção de vendedor também passaram. Total aprovado26 casos distintos em dois arquivos, não somar rerun nem controles duplicados. ROOTrestore93feae EXIT0 devolveu1389linhas/428t/502ledger/zero outros atores/listeners. Lease encerrada, nenhum SQL posterior.

Lint após duas correções test-only bc9228 EXIT0; TSC0 acima antecede essas duas mudanças nominais de fixture, sem alteração do código produtivo. Core SHA3b4c4d09 preservado. C2 comprovado neste recorte: zero Configupsert/DML no ACK; restante da serialização não foi reordenado nem medido para alegar melhoria concorrente. Global/build e QA independente/CI/visual da futura composição pública continuam PENDENTES. Os79 históricos/dez arquivos não foram repetidos nem atribuídos a este HEAD. Issue não concluída por este checkpoint.
## Histórico de autoria C3/C5 — mapa nominal118, antes da execução C2

Fonte composta local00a8a330 (MAIN960 + D10/459 preservados) com delta C5. Execução completa1c9171 EXIT0,118/118; inventário coletado sem execução dd0145 confirma os nomes abaixo. Os115 anteriores são a fonte antes dos três casos C5, não somar como casos distintos adicionais.

| Arquivo UNIT | Casos desta execução |
| --- | ---: |
| src/server/inbox/agendadas-operacao-inbox.test.ts | 36 |
| src/server/inbox/agendadas-policy.test.ts | 27 |
| src/server/inbox/agendadas-leitura.test.ts | 10 |
| src/server/inbox/agendadas-cancelamento362.test.ts | 22 |
| src/server/inbox/painel-atividade362.test.ts | 7 |
| src/server/whatsapp/agendadas362-consulta.test.ts | 3 |
| src/server/whatsapp/acoes-agendadas362.test.ts | 13 |

Nativos da fonte produtiva anterior3b4c4d09: inbox-idempotencia.int.test.ts10 (a66ddb0) e agendadas-operacao-inbox.int.test.ts16 (f5c95e0). Não atribuir esses26 ao novo texto C5 sem regressão posterior. Novo agendadas-config-concorrencia362.int.test.ts2 apenas autorado, aguarda lease; mede SQL Prisma real/4PIDs/paiA bloqueado e paiB independente, com ACK controle. P2028/infra/observer inconclusivo não contam REDproduto ou GREEN.

C5 RED305908 EXIT1:36casos,1falha causalCRIAR texto “alterar” e35controles. Correção apenas mensagem por tipo no gate; GREEN1c9171 sete arquivos118/118, preservando responsabilidades/negativos/REAGENDAR/ENVIAR. Não alterar toast/UI de sucesso: não era o comentário. C4 SQL501/502 imutáveis e C6 tabelaD11/GP humano atualizados somente em documentação. C2 permanece parcialmente resolvida; novas operações dependem medição. Naquele freeze: lintc455b3 EXIT0 trêsTS/zeroavisos e TSC ainda em acompanhamento; terminalebd91d0 posteriormente registrado abaixo. Nenhuma SQL/global/build nesta autoria.
TSC original8192 final34b6bd/sess43204→ebd91d EXIT0 na fonte Main960+autoriaC2/C5; lintc455b30/diffcheck025f110. Não executado SQL/nativoC2; gates de coleção/tipagem não comprovam performance/lock real.

## C2 — medição real concluída, sem reordenar novas mutações

FonteC5/corec2c608ab + nativo9ab40d9c, Prisma5.22/config original/dev-gravacoes/Hermes1024/UTC7blank/w1/nofileparallel:9b425d/sess81910→22ef92 EXIT0,2/2,11.28s(tests8.90s). Singleton ConfigIA existente. Em ambos os casos, A já esperava SELECT paiFORSHARE após upsert; B em outro pai terminou ANTES de liberarA. QueryeventPrisma real mostrou apenas SELECT ConfigIA nas novas operações, INSERT/UPDATEfalse; ACKB zeroqueriesConfig. Quatro PIDs distintos por caso e bloqueadores observados; nenhum convoyConfig, todos quatrocleanupfulfilled, ambosworkerssucesso. Log SHA12285c60e396979521428acc68bd85effecce21a9d3d4067ac193fcb964eb1ea; recibos sanitizados privados copiados byteexatos de OS.tmp: nova b1ba49d2b4978e8f9224566d28e650df31e8e04c2334f7ce6c356a02c5c82d14 e ACKd9847908ec2453298539caaf1e21f71f502af24f3d6d5a8741778dc26cd54717.

A hipótese C2 de lock global no hot path da singleton existente não se reproduziu no Prisma instalado: update:{} não emitiu DML nesse cenário. Não alterar ordem/preparação sem causa. Limite: inicialização concorrente quando ConfigIA ausente NÃO medida; duas amostras não demonstram ausência global de contenção/carga. ZeroDML ACK é separado desse controle. Nenhum P2028/erro infra usado como aprovação. ROOTrestorec47cf3 EXIT0 baseline1389/428t/502ledger/zero outros atores/listeners;lease encerrada.

C4 índice de migrações atualizado com IDs reais501/502 e bytes aplicados imutáveis, preservando faixas históricas. C6 tabela original de decisõesD11 recebe esclarecimento datado sobre GPcall52bba613 e ACK de leitura, sem criar capacidadeCRMglobal. UI#363 é encaminhamento separado: controles futuros não são declarados entregues pelo servidor362. Global/build/QA pública exata/CI continuam pendentes.
Após a última lease C5, ROOTrestore56b141 EXIT0 confirmou novamente baseline1389/428t/502ledger/zero outros atores/listeners. Nenhum SQL DEV posterior; a restauração c47cf3 acima pertence à lease C2 anterior.
