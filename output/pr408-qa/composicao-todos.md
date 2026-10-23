# PR #408 — vínculo de tarefa e todos os comentários

Fonte7a94fc12a43df6055fb63683e81aaabc8e2e6018, pais e6c8d86d (cherry-pick45dd documental sobreddf) e4077ca3dc6f. Delta próprio exatamente sete caminhos322: duas migrations, schema, executorAria/testeINT e tarefas/testeINT. OIDs iguaisddf/cea, sem adaptar autorização, hash, evento ou SQL. App/harness/Pick/manifestos/B2/QA280/planejamento297 e os seis produtores321 iguais407; nenhum323/337 antecipado.

C1 HIGH: quatro arquivos INT exigidos executados completos na fonte7a após aplicar e validar as duas migrations no banco descartável. C2 MEDIUM/C3 MEDIUM: CI final e integração depois407main continuam gates; não se confunde a composição local com merge antecipado. C4 MEDIUM: seis blocos do quadro preservam ambos os lados, sem conflitos de código no delta próprio. C5 LOW: SPEC relaciona os critérios aos testes reais, incluindo a cobertura parametrizada e os casos legados; nenhum teste foi renomeado artificialmente.

## Ambiente e SQL

Preflightb53fd1 terminal0 confirmou perfilci-integracao/localhost54329/erp_genius_test_ciint,485migrations aplicadas, nenhuma estranha e exatamente duas pendentes reservadas322; zero atividade alheia no banco. node_modules/.prisma/client e pais são físicos dentro deste worktree, sem junction. CLIPrisma aplicou somente20261023100000_tarefa_atendimento e20261023110000_tarefa_atendimento_indice; geração do PrismaClient próprio5.22.0 terminou na mesma sessão35919/2a60ea, terminal0,63,63s de geração. Sem npm/install ou mudança de package/lock.

PreflightSQL08056a terminal0:487migrations aplicadas, atendimentoId TEXT/is_nullableYES, FK validada com DELETE RESTRICT/UPDATE CASCADE e índiceTarefa_atendimentoId_status_idx com indisvalid/indisreadytrue sobre(atendimentoId,status). ÍndiceCONCURRENTLY permanece em migration separada. Nenhum bancoRoot/A/B/TESTER, cluster ou provider real foi alterado.

## Gates próprios

- Unitário1f836f terminal0:3arquivos/72testes, America/Sao_Paulo, maxWorkers2 (tarefas-regras, permissõesInbox e dependências). Não é global.
- Integração81621/2677ed terminal0:4arquivos/62testes,180,27s, America/Sao_Paulo, maxWorkers1/configintegration, perfilciintegracaoexclusivo. Arquivos completos:tarefa-atendimento.int.test.ts, aria/turno/executor-crm.int.test.ts, criar-tarefa-idempotencia.int.test.ts e tarefas.int.test.ts. Sem filtro/skips novos ou suíte concorrente nesse banco. Escopo, idempotência humana/Aria, legado, concorrência e rollback cobertos. Não é suíte completaDB.
- Next typegen/TypeScript66347/74421a e lint global6984/09b8b3 terminais0, zero erros/40avisos herdados.
- Provasfbe093 e validação posterior confirmam produtores/schema/testes próprios iguaisddf; diferença executável residual sobre407 enumerada em sete caminhos. As duas fontesINT inicialmente nomeadas genericamente em uma asserção foram substituídas pelos caminhos reais aria/turno/executor-crm e crm/tarefa-atendimento na prova anterior ao ambiente; os quatro caminhos do comandoINT foram conferidos existentes.

QA documental45dd favorável, original SHA256 f5184ac9bdc56424903ee7dbdf3f91cbe386441d0c9848a596799e18819fa14d. QA composta7a favorável estática, sem novos testes/DB no parecer: sete caminhos iguaisddf/cea, SQLnullable/FK/CONCURRENTLY e demais produtores/pais preservados. Original SHA256 aad2fc15ad0d081211eb947a423d5db8e3b002d20566b2408bb4b67078eb3d97, cópias tester-patch-45d.md/tester-composicao-7a.md com apenas EOF normalizado.

Global agregadoCEA904/7.118 e gates históricos continuam nominais àquela fonte. Squash407main e CI final408 em dois fusos ainda pendentes. Sem captura, seed, mensagem real ou deploy de aplicação.

## Sincronização final com a main

407 integrada por squash23916ac1e911c7844f28b283d3e154abf0da7b4b, CI40028951056success5/5,904arquivos/7.125unitários em cada fuso, issue321CLOSED. Árvore inteira igualde608281. Sua ancestralidade foi incorporada à candidata0674128e; três blocos do quadro continham somente registros já preservados da candidata e duas linhas em branco, sem conteúdo recebido exclusivo. Índice inteiro igual0674128e antes do commit. Fonte não Markdown igual7a94fc12, sem nova execução de banco/testes após MD/ancestralidade. C3/C4 resolvidos; retargetmain e CI final408 seguem obrigatórios, sem antecipar323/337.
