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