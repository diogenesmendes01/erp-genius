# #338 — QA DEV D10 R30

Checkpoint funcional local sobre cc039; fonte pública será selecionada pelo ROOT sobre o antecessor PR439. Nenhuma QA independente, CI remoto, visual obrigatório ou conclusão da issue é presumida. Instalação/DDL/generate/push não foram executados pelo DEV.

## Proveniência offline

31puros pertencem ao checkpoint cc039 e QA R28, não são RED de runtime. Contratos/helpers/writers/leitor/UI/configuração/intenção/materializador receberam REDs assertivos próprios; logs privados preservam negativos e controles. Consolidado ea25f4 EXIT0:351/26arquivos antes das duas últimas guardas fresh. Arestas finais RED e0b80a EXIT1=2assertivas/6controles; GREEN ff0b39 EXIT0=21/5arquivos afetados, incluindo preservação de draft e rollback em double. Não somar execuções sobrepostas nem atribuir doubles a SQL.

Anotações/defaults de fixtures legadas foram ajustados sem relaxar ACL/DTO/domínio. Inventário de botão Modal passou a Atualizar colegas, guarda preservado. Lint final das mudanças anteriores1abaf8 EXIT0/0avisos; fixture CHECK82ec17, oráculo90e40e e racesaf2e60 EXIT0. TSC original8192/--noEmit/--incremental false finalba19c6 EXIT0 na árvore com todos os nativos. Configs originais, executáveis próprios, UTC/sete provedores vazios; UNIT/TSC offline DBport1.

## SQL real —45 casos distintos em9arquivos

Leases exclusivas A503/dev-email, cliente861b, Hermes1024/UTC7blank/configintegração original/w1/no-file-parallelism, arquivos completos sem filtros/skips/bail/retry. Cada executor acompanhado até terminal. Nenhum transporte externo real.

| Arquivo | Casos | Terminal aprovado |
| --- | ---: | --- |
| inbox/tarefas-d10.int.test.ts |10|2b21bf EXIT0|
| inbox/tarefas-d10-concorrencia.int.test.ts |8|0771be EXIT0|
| inbox/tarefas-d10-pool1-notify.int.test.ts |3|c44b07 EXIT0|
| crm/lembretes-d10.int.test.ts |4|14d528 EXIT0|
| crm/notificacoes-tarefas.int.test.ts |11|1091e1 EXIT0|
| crm/notificacoes-tarefas-pool1.int.test.ts |1|b25793 EXIT0|
| crm/tarefa-recorrencia-d10.int.test.ts |4|7b0d31 EXIT0|
| crm/tarefa-recorrencia-tempo-d10.int.test.ts |2|35acef EXIT0, oráculo fortalecido|
| inbox/tarefas-d10-fresh-races.int.test.ts |2|8672fe EXIT0|

Os seis legados37 não foram repetidos por correções test-only posteriores. Recorrência4 prova conclusão real→intenção→fev/mar/âncora31, cron atrasado/corte imutável/replayclock0, reabertura sem filho e sete snapshots SQL inválidos mais controle. CHECK esperou23514; tentativa anterior0ba081 teve3pass/1fixturefail23502/P2010 porque rawINSERT omitia atualizadaEm. Negativo preservado, correção apenasfixture e inversa exata, sem alterar CHECK/produto/SQL503.

Oráculo forte35acef substitui a evidência temporal fraca131624. Brackets JS antes/depois de cada clock_timestamp na mesma TX, tolerância250ms, current_settingTimeZone UTC/SP confirmado. JSONs sanitizados gravados antes dos asserts e finally: PG↔JS0–1ms, corte==concluidaEm e SQLepoch==Date; início2030-01-31T09Z preservado. Audit default retornado pelo produtor Prisma ficou+30ms emUTC/+16ms emSP desdeJS; corte+1ms/0ms. Sem compensação3h. Não estende prova a rawINSERT arbitrário. Recibo f6c4e3bc e cópias byteiguais UTCc1a6e6cc/SP938bb5d1 preservados.

Races2: PIDs separados e callthrough SQL real. Preview:1201792/1202272, catálogo lido→revogação COMMIT confirmada→catálogo atual, ErroRegra exato 'A prévia mudou. Atualize os colegas disponíveis.', Task/Evento0. Fanout:1201792/1202540, INSERT real→revogação COMMIT→causa no limite TX; ErroRegra exato 'O lembrete mudou durante a entrega. Aguarde o próximo ciclo.', ABERTA/claimNULL/notificações0/Evento0, papelALUNO confirmado. Contrato externo observado rejeitou a mesma causa. Nenhum P2010/P2028/40P01 aceito como domínio. Cleanup terminou com a suíte. Recibo f828d993; JSONs preview1c3ea123/fanout4a6b347f. RED UNIT é e0b80a; não houve RED nativo de inversa. Tentativa7b7bdf falhou2/2 na instrumentação do parser Papel[]; preservada em2009cad7, corrigida apenas SELECT::text[]/registro raw antes da igualdadeALUNO exata.

ROOT restaurou A503 após cada lease; último031c9a EXIT0,567baseline/428t/hashescatálogos. Somente ROOT usa preservar-banco-devemail-a503-r30-private.mjs; restorer antigo retirado. Schema01086/SQL50356ab/4973423/4986044/cliente861b/AGENTS0544 preservados. Não é integração global, QA independente ou prova de deadlock freedom global.

## Gates globais e pendências

UNIT global original65a931 EXIT1:1102arquivos=1098aprovados/4falhos,9912casos=9907aprovados/5falhos,UTC/heap4096/w1/semfiltros. Quatro falhas D10 foram corrigidas: rótulo de recorrência na lista fechada, exceção DOM useId e dois tokens text-muted inválidos. A extensão nominal do mapa usa enum Prisma/AST/freeze com negativos de família/chave/valor/mutabilidade; referência DOM exige constid=useId React, único Botao e alvo único, recusando DTO/prop/outrocomponente/duplicação. Paleta corrigida para text-gray-600 canônico; guards genéricos/ARIA/tetos preservados. GREEN focal finala40166 EXIT0:244/6arquivos completos (ID/enum/paleta/UI/labels); lint90305c EXIT0/0avisos e TSC399757 EXIT0 original8192 após essas mudanças.

A quinta falha global é preexistente nesta base privada: CamposMap não lista oito campos Documento454 nas duas UIs; manifesto e UIs já eram os mesmos de HEADcc039 antes do D10. ROOT confirmou que main tem o guard Documento correto e determinou NÃO importar/corrigir o delta Doc no338. Não repetiu o global privado condenado à mesma falha; não o chama aprovado. Seleção pública terá gates globais independentes sobre main correta.

Lint global3035fd EXIT1:0erros/50avisos com teto40 intacto. Mapa64776761 confirma40avisos SRC em blobs idênticos a HEAD+10avisos em artefatos output antigos não rastreados; zero avisos nos paths do checkpoint. Nenhum arquivo foi ocultado/removido para passar lint. Focais D10 sem avisos; não presumir resultado de CI.

Build original:6399f9 EXIT1 por OOM do worker TypeScript perto4GB, após compilação. Negativo preservado. Retry com NODE_OPTIONS8192 temporário herdado, DBport1/7blank e configuração original:d9efd7 EXIT0,compilação/TypeScript/static115. Esse build antecede somente a troca dos dois tokens de cor e extensões de testes guard; ROOT dispensou rebuild privado por essas mudanças, cobertas por244focais/TSC finais. next-env ignorado foi gerado pelo Next; tsconfig,packages,perfil,AGENTS e fontes congeladas mantidos.

Visual tarefa-nova-mais-opcoes, seleção pública, revisão independente, CI e homologação continuam pendentes.45nativos distintos são recortes, não integração global. Checkpoint funcional local não equivale à conclusão338. Não ampliar suíte sem falha/preocupação concreta; ROOT fará o porte seletivo, sem ancestry privada Grant/372/362.
## PR458 C1/C3/C4 — DEV B, nova fonte pública b5c6ea22

Retomada autorizada sobre b5c6ea22bf5937dea00279da7bcf0c9c68a4341b (deltaDOCONLY de93286), branch codex/inbox-e2-338-review. Ambiente preparado ROOT3578→63b042EXIT0, client0084f4dd..., perfil inicialci-int preservado; ROOT depois alterou sóperfil para dev-gravacoes com backup e lease própria no PUBLIC503502migs/428t/1389linhas. B não gerou client, mudou perfil ou aplicou DDL. Isso não é preparação456 nem herda seus gates.

RED focal5UNIT completos c6b21bEXIT1:75casos/7falhas causais/68pass. Demonstrou batch abortando apósA, snapshotlegalDB inválidoZod sem tratamento terminal, falhaEvento impedimento não alcançada, cron acoplado e tarefaB desfeita comA, avisoC3ausente. Intermediário860f7cEXIT1=2/75 por fixturecron defaultundefined e expectativa nova sem lembreteAntecedenciaMin:null que o diff existente já preservava; corrigidos sóharness/payloadesperado, sem reancorar/relaxar produção. GREEN455c51EXIT0:79/5 completos.

Revisão de identidade do ramo inválido produziu RED adicional dfaf3fEXIT1:20casos/1falha/19pass; conclusãoVersão alterada durante espera ainda era consumida. Fix guardou testemunho de id/tarefa/conclusãoVersão/versão/corte mais snapshot e compara após Tarefa→Intenção lock, antes deCAS. GREENregressão final10arquivos235/235 sessão76559→fca2d3EXIT0,13,12s: cincofocais+configuração/regras/intenção/calendário+guardasbotões/vazios completos, sem casefilter/skip. Os três antigos testes de acoplamento foram substituídos explicitamente por independência, zero candidatos e propagação de erroclaim; a prova de erro de materialização e originalidade permanece no worker/cron, não foi convertida em sucesso. Chave nominal nova noJSONcron foi registrada no teste existente.

Lint final11TS d9aebfEXIT0 --max-warnings0, depois de preservar lint69fae0EXIT0com2warnings de parâmetro mock. TSC original75240→5a23f7EXIT2 preservado: TS2493 do próprio mock e TS2739 no outputdiagnóstico326 histórico. O mock foi tipado; ROOT arquivou o diagnóstico byteexato SHAa10772d2... em node_modules/.cache sem mudar tsconfig/DTO/fonte. TSC38121→04c36cEXIT0 após esses reparos; o TSC final da autoria nativa/identidade está sendo acompanhado, sem presumir0.

Nativos novos AUTORADOS, ainda não executados neste registro: lembretes-d10.int7 completos (4originais+3C4) e tarefa-recorrencia-d10.int7 completos(4originais+3C1/C3). Fetch inesperado lança/assert0, sem mensagens externas ou timeoutcustom. Os produtores destes dois arquivos não emitem pg_notify atualmente; não atribuir provaNOTIFY por instrumentação. Nativos reais/leases/recibos e revisão independente serão acrescentados após terminal. QAglobal/CI/visual continuam pendentes; não declarar338concluída.

### Fechamento DEV dos gates PR458 C1/C3/C4, antes de revisão independente

TSC final da autoria congelada: sessão14054/f63697→9f502a EXIT0 original --noEmit --incremental false/heap8192/UTC/mocklocalhost1/7provedoresvazios. Lint11 d9aebfEXIT0 --max-warnings0; UNIT10arquivos235/235 já registrados. Recibopré-native output/inbox-338-review-pre-native-refreeze-private.json SHA486138c9... fixou14paths antesSQL; todos14 foram conferidos byteiguais após o último nativo. Nenhuma fonte/fixture/assert/timeout foi alterada durante as execuções.

ROOT concedeu lease exclusiva no descartável dev-gravacoes PUBLIC503 (502migrações/428tabelas/1389linhas), confirmou migrate status original82af73EXIT0 apesar dos extras501/502 preservados; DEV não alterou setup nem migrations. Comandos seriais próprios, Hermesheap1024/UTC/7blank, configuração integrationoriginal, w1/no-file-parallelism, sem filtros de casos/skips/retries ou timeoutcustom. Mesmoexecutor acompanhado até saída terminal0 em cada arquivo:

| Arquivo completo | Casos | Executor/sessão/terminal | Duração |
| --- | ---: | --- | ---: |
| crm/lembretes-d10.int.test.ts | 7 | 105ed4 / 76303 → d70b30 | 25,61s |
| crm/tarefa-recorrencia-d10.int.test.ts | 7 | 739608 / 18603 → 826e1e | 27,78s |
| crm/notificacoes-tarefas.int.test.ts | 11 | d62f3f / 59086 → e53e50 | 40,47s |
| crm/notificacoes-tarefas-pool1.int.test.ts | 1 | fb9ca7 EXIT0 direto | 5,54s |
| inbox/tarefas-d10-fresh-races.int.test.ts | 2 | e2e08d / 8292 → c057ad | 10,24s |
| crm/tarefa-recorrencia-tempo-d10.int.test.ts | 2 | 44659a / 19491 → 89ee42 | 9,16s |

São30casos distintos nesta execução de seisarquivos; os dois focais14 contêm8originais+6novos, não14casosnovos. Não somar com os45nativos históricos como se todas as fontes fossem iguais. Sha dos dois arquivos alterados: lembretes9ecd551cb75e770ca98e606f5419adab19fe74513c73dbf96a0a587be4c1088b; recorrência2961fd6745d68e5790a561907964b06834fc837f8b021f02219228f25e18f7bb.

Novas provas nativas alcançadas: (a) snapshotDBlegal{versao:1} mas estruturalmente inválido vira impedimento auditado, enquanto intençãoB e lembreteC progridem; (b) falha INJETADA após INSERTreal de Evento de impedimento reverteA e Bmaterializa, preservando objeto de erro; não é alegação de erroPostgres espontâneo; (c) editar data/hora local e concluir mantém próxima ocorrência no calendário original; (d) falha injetada após EventoSQLreal de lembrete reverte sóA e Bconfirma claim/NotificacaoUsuario/Evento, replay duplica nada; (e) writerPGreal desativa destinatário após últimoEventoA, guardfinal recusaErroRegra canônico exato e reverteA sem desfazerB; assertsdePIDsdistintos/fases reais passaram, mas Vitestsuprime console de casoaprovado, então não alegar números brutos publicados; (f) doisworkers preservam claim único porTask. Infra/P2028 não foi usado como resultado de domínio. Fetch inesperado bloqueado/assert0 nos dois arquivos alterados. NenhumNOTIFYfoi adicionado e não há prova de NOTIFYcommit destes produtores, que atualmente não emitem; a prova é de dados/eventos transacionais.

LEASE_END enviado ao ROOT imediatamente após89ee42: semSQLextra/semrestauroDEV. ROOT restaura1389 comrestorerpróprio; recibo de restauração será atribuído separadamente quando informado. Banco ciint/dev-email não foi usado. Commit/seleção pública/revisão independente/QAglobal/CI/visual ainda dependem ROOT/T; o recorte não encerra a issue338.

ROOT confirmou restauração dev-gravacoes21eec6EXIT0 e auditoria2106f5EXIT0 apósLEASE_END:1389linhas/428tabelas/502ledger/sequências/seiscatálogos/hashes/0atores/listeners. Nenhum SQL adicional peloDEV. Checkpoint local autorizado em15paths (14do recorte+catálogo do códigoSNAPSHOT_INVALIDO); documentação apenas após as execuções, fontes11 permanecem iguais. GlobalUNIT/build desta revisão ainda não executados; proposta de execução original com mocklocalhost1/7blank aguarda coordenação de memória ROOT com o globalA. Publicação, QAindep/CI e visualC3 não são presumidos pelo commit local.
