# #369 — contexto opcional e resumo na transferência Inbox

Em validação; não homologado visualmente, sem push/PR pelo DEV. Base 3b4cf1b5ce5a001ed6dacc7eddbc5c51a3934534. #360 e R2 são referências congeladas separadas; D5 depende ainda de370. Não existe grant/schema494 ou exceção genérica por responsável nesta entrega.

## Mudança

Novo entrypoint setorial Inbox com schema trim/default vazio/max1000 e anexarResumoAria defaultfalse. Opção de modo é interna ao caller, não campo de bypass cliente. Schema/hash/retorno de transferirAtendimento global e todos os corpos da pessoa/fila/Aria permanecem. UI envia só conteúdo booleano; fonte/actionId/texto do resumo e ator são escolhidos no servidor.

resumo-nota faz1 SELECT db-aware: atendimento autorizado → HANDOFF EXECUTADA → JSON string e trim não vazio ANTESdoLIMIT → criadoEmDESC/idDESC. A lista de whitespace corresponde a String.trim, incluindo NBSP/BOM; não busca só a última nota inválida e descarta uma válida anterior. Sem IA, HTTP, DTO falso ou import Prisma global no helper. Metadado público sóbooleano, escopo/capatransferir atual e atendimento aberto, sem payload.

Ordem nativa: repeticaoIdempotente existente antes do pai → Atendimento FOR UPDATE → fresh ator/ativo/papéis/permissões + atendimentoVisivel/capatransferir → resolverDestino e setores atuais → leitura resumo (sem FOR UPDATE Acao) → encerramento/garantirAtendimento/advisory histórico → dois eventos de transferência e até duas notas no destino. Replay Inbox não retorna cedo: revalida ator e origem mesmo encerrada e confirma vínculo destino/origem/conversa. Default global continua retornando replay cedo como antes, sem mudança silenciosa. Não adicionados advisory, lockConfig/Acao, dispatch ou cancelamento novo. Setor conserva cancelamento histórico do encerramento; pessoa continua somente HUMANAS PENDENTE/ADIADA da etapa360.

Nova nota de contexto só se não vazia. Resumo solicitado/disponível vira nota separada com origem=resumoAria/acaoAgenteIAId interno. EventoTransferido novo usa contexto null quando vazio. Falha da segunda nota desfaz fechamento, novo atendimento, primeira nota, eventos e cancelamento na MESMA TX. Hash novo inclui checkbox, mantendo conflito quando mesma chave muda o conteúdo. APIs CRM/globais e carteira não foram ampliadas.

UI: contexto opcional e checkbox marcado por padrão quando existe resumo autorizado; preferência humana preservada, callbacks/geração e leitura por abertura da360 mantidos. Metadado consulta só ao abrir; sem SSE/polling/heartbeat. Retorno de #360 R2 preservado pela prop renderizar explícita; Header não alterado na369.

## Gates reais

- INT novo 11716/a46280 EXIT0,1arquivo completo20 casos,79,14s: vazio/curto, proveniência,2 notas, JSON/whitespace/data+ID, isolamento/estado, hash/replay, rollback pontual, concorrência, fresh ator após espera real (inclusive replay), metadado autorizado, pool1 e negativas destino/max1000.
- Regressão 68963/c77fcd EXIT0,2 arquivos completos20 casos,101,50s: transferencia.int.test.ts e atendimento-idempotencia.int.test.ts. Não repetidos reg41/pessoa, pois seus caminhos continuam literais. Nova prova do global min12/hash/ignorar opt-in está também nos20novos.
- UNIT focal 42334/bcb61a EXIT0:117 arquivos/1410 casos,92,36s. Inbox inteiro + Botao/Modal +4units backend +5guardas relacionadas. NÃO global.
- Formulários e Campos originais5804/f90502 EXIT0:2arquivos51 casos, sem modificar parser/negativas/exceções. Somente nominal Campo obrigatório→opcional/dica mudou.
- Lint/whitelist/sourceproof/pins no recibo final. Sem atribuir gates ROOT ou de outra feature a este source.

## Negativos e qualificações

Fonte: resumo 7892b0(3 falhas/7); schema 7c5904(1/5); núcleo dfb26f(6/8); UI 54ad9b(4/15); metadado 909c08(2/8); adaptador 67855c(4/8). Replay fonte final f51aa4 EXIT0(12arquivos71 casos), seguido de revisão da360R2 sem perder WIP.

Nativo inicial89018/463288 EXIT1:13 falhas/7 pass, sendo1falha da fixture concorrente importando next-auth/next-server, NÃO RED de produto. Corrigida só sessão fixture para authMock + carregarUsuarioFresco real/apenasPortal, como INT357/358. RED canônico45435/6838e5 EXIT1:12 falhas/8 pass, mesmoarquivo20; baseline troca SOMENTE função setorial pela default360/3b4, runtime SHA eaaab16c364206d2470309e7da84d6db436fce735ddf0f741260078fe51b588c. Ausência de espera no replay legado é negativa de lock, não uma prova isolada de freshator. GREEN 11716/a46280 20 pass após restore byteigual 68cdae0b8d89b80e4299d622f77da6acdb1f75616c993dee842c6933467329d0. Artefatos negativos e fontes preservados.

HANDOFFs são fixtures de AcaoAgenteIA, não execução de agente/driver. Uma injeção pontual ErroRegra ao gravar nota-resumo prova rollback PostgreSQL; demais SQL/ACL reais. Barreira pg_blocking_pids/lockparent real, loop com limite e chamada drenada, sem sleeps adivinhados. Pool1 usa núcleo/contexto/resumo reais e helper sem dependência Prisma global. Nenhum provedor externo configurado; sete nomes vazios somente no executor.

## Preservação e ambiente

369 pausada para corrigir360:18 paths salvos em cópias .txt/hashes e stash dbaf41bb407d0963e56d18406f051a2d663e2289. Após ff 3b4,17 arquivos restaurados byteiguais e Conversa recuperada como backup369 +3 linhasR2, sem perder metadado. Recibo output/inbox-369-restore-after360r2-private.json SHA25f25304a22af0b9fe99296f639bb7fa9a4cf8d7f6feacf9cc6e5b0938482283. Depois disso somente fixture auth/controle de chaves proibidas e mapaCampo foram atualizados conforme TDD; stash/backup originais preservados.

Admissões: ci-integracao/erp_genius_test_ciint/492/424 incluindo migrations/cliente 647/zerooutras conexões. Após nativo20, RO 8c9203 e ROOT restaurou b114ee. Após reg20, RO 032e76 EXIT0,492/424/0outras e fixturefinal1 Atend/1 Evento/1 Intent, banco LIBERADO, não declarado503peloDEV. NenhumaSQLnova semlease. Banco/cluster não iniciado/parado pelo DEV.

Pendências: revisão técnica antescommit individual369, QA independente exact, gates originais TSC/global/lint/build pelo integrador e visual. Não marcar D5 completo antes #370. Nenhum schema/migration/client/package/lock/config/envfile/install/generate/servidor/browser/HTTP/push/PR nesta etapa.

Normalização coordenada ROOT360 (88aa57d7): somente destinos = [] no parâmetro de CoordenadorAcoesConversa, preservando Props.destinos opcional. Focal169547 EXIT0:2 arquivos/10 testes; lint afetado47b343 EXIT0/zero avisos. Oráculo ROOT undefined.filter/TS2322 preservado pelo integrador; não copiado nem atribuído como teste local.
