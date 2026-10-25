# QA #341 — probabilidade e previsão (WIP)

Base: 8096683c5d812e3c61adb8ec452dd47cd6fb46b7. Branch: codex/inbox-e2-341-previsao. #377 permanece recuperável na ref anterior. AGENTS M histórico preservado e excluído da entrega. Nenhum install, generate, DDL, provider, build, TSC ou teste global executado pelo DEV. SQL nativo foi executado somente na lease A495 descrita abaixo.

## Evidências observadas

- RED 903003: 48 falhas por módulo puro ausente. GREEN ec4df4 EXIT 0: 48 casos.
- RED f2ec3d EXIT 1: 2 falhas por EditarLeadSchema ausente; 1 controle legado passou. GREEN 6b4db2 EXIT 0: 3 arquivos/59 casos.
- RED d88322 EXIT 1: 4 falhas por setter ausente. Dois negativos aceitaram esse erro e não comprovavam autorização; foram reexecutados com o setter implementado, sem reclassificá-los como SQL.
- Negativo 587e70 EXIT 1: o aviso recebeu campos além dos IDs esperados. A projeção explícita corrigiu isso. GREEN 13c18e EXIT 0: 4 arquivos/65 casos, sobrepostos aos schemas.
- RED UI 0dc406 EXIT 1: 6 falhas por componente ausente. GREEN 2b67c2 EXIT 0: 6 casos.
- Recorte final: sessão 6471, terminal 1c4580 EXIT 0, 10 arquivos/180 testes, UTC, um worker, heap 1024, paths explícitos, sem filtro por nome ou skips. Inclui schemas, setter instrumentado, DTO, UI e consumidores Inbox/Funil. Não é suíte global nem SQL.
- Lint final: sessão 99938, terminal d95232 EXIT 0, 25 arquivos, zero avisos.
- Complementos posteriores, distintos dos 10 arquivos: wrapper público unitário 73e8fd EXIT 0, 1 arquivo/4 casos; consumidor de edição CRM 04de8e EXIT 0, 1 arquivo/16 casos. Não é uma única execução de 12 arquivos. Lint desses dois arquivos db86e4 EXIT 0, zero avisos. O teste do wrapper observa a leitura de SQLSTATE somente depois do rollback do double; não substitui o caso SQL real.
- Lint negativo d9cfd1 preservado: refs durante render e setState em efeito. Corrigido o ciclo sem relaxar regras. A geração de abertura invalida ACK; refresh não apaga o formulário.

O manifesto privado contém os arrays exatos de 10 testes e 25 fontes de lint. Sourceproof 47b8bf confirmou o corpo de criarLead, LeadSchema e CriarLeadSchema literais à base após normalizar LF. Essa comparação não alega igualdade dos bytes CRLF de checkout.

## Cobertura e limites

Schemas puros: extremos 0/100, omissão/null/vazio, fração/NaN/infinito/booleanos e exponentes textuais, datas impossíveis, bissextos, data passada e seis fusos de processo sem mudar a data civil. O input estrito não recebe autor, carteira, IDs arbitrários, fuso ou chanceFechar.

DOM: zero distinto de ausência, data civil, readonly sem controles, cancelamento sem action, referência física do campo preservada em refresh, envio apenas do campo alterado, limpeza null, erro e transporte incerto sem retry, duplo envio bloqueado, ACK antigo A→B→A e perda de capacidade. Usa ReactDOM e o harness mínimo local, sem mock do hook de ação.

## Nativos na fonte congelada 997acd53

Admissão exclusiva ROOT aecc2c EXIT 0: 425 hashes/560 linhas originais/sequências/snapshot conferidos, zero outros atores/listeners. Reserva lógica495, contagem real de 494 migrações. Quatro arquivos completos, executados em série com vitest.integration.config.ts original, perfil próprio, UTC, um worker, heap1024, sem paralelismo, filtros por nome ou skips. Sete nomes zerados explicitamente: MOTOR_URL, MOTOR_API_KEY, MOTOR_WEBHOOK_SECRET, WHATSAPP_LIVE, OPENAI_API_KEY, ANTHROPIC_API_KEY e RESEND_API_KEY. Nenhum .env ou segredo lido.

| Arquivo | Sessão / terminal | Resultado |
| --- | --- | --- |
| previsao-oportunidade.int.test.ts | 53901 / 6f3465 | EXIT 0, 10 testes, 48,67s |
| previsao-concorrencia.int.test.ts | 56078 / bc82e3 | EXIT 0, 5 testes, 27,41s |
| previsao-pool1.int.test.ts | 96017 / 98cf3d | EXIT 0, 1 teste, 9,10s |
| previsao-notify.int.test.ts | 24436 / fe3abd | EXIT 0, 3 testes, 17,77s |

São 19 casos nativos sem sobreposição entre esses quatro arquivos, autorados após implementação; não são REDs retroativos. SQL, ACL e transações são reais. Actions usam mock de sessão/nextcache, mas ator e autorização do núcleo são relidos do banco. Nenhum provider foi chamado ou simulado, porque estes writers não chamam IA ou envio.

O interleaving com atribuirDono REAL confirmou a espera no Atendimento por pg_blocking_pids. A barreira instrumental pausa somente após o SQL real delegado do setter; liberar a barreira provoca NOWAIT55P03/rollback e permite terminar a transferência. Isso não prova ciclo/deadlock produtivo ou ausência geral de deadlocks. Papel Portal/carteira após espera e FK do País com revogação também recusaram sem mutação.

LISTEN real confirmou um aviso de IDs no commit, zero no no-op repetido e zero no rollback. SELECT 1/0 posterior à mutação, Evento e NOTIFY na mesma TX causou rollback dos três efeitos. Pool1 atravessou setter, editarLead e leitor, sem cliente global dentro da TX.

Recibo privado com comandos, paths, hashes dos logs/fontes e pins antes/depois: SHA 2e924e493f946af918db8b9262c09976a81774c8ab2543dca588bc3721c4739f. HEAD permaneceu 997acd53 e pins schema/SQL/client/perfil/AGENTS ficaram iguais. Avisos habituais MIXED_EXPORTS e tsconfig-paths preservados. Todos os executores terminaram; holders/listeners fecharam em finally/afterAll. Lease A495 e Node liberados ao ROOT após fe3abd; restauração não presumida pelo DEV.

Schema/SQL congelados para revisão ROOT/T: schema SHA 7522228da4465511edbe603d59829f535c3775554cbd931b9b00a7b72608cf22; SQL SHA 4b1f5b4d3594fa581ecf25894f779936b704759c7e945fc7ef06cfb05b1e07d2. O client anterior 72b4825a foi preservado até a preparação exclusiva do ROOT; nenhum cast de produção mascarou campos ausentes.

Infraestrutura pronta pelo ROOT: validate e64939 EXIT 0; generate 97558/dfe8ab EXIT 0; client e251ba321793510fa473b2778f6d4ffd9f0ef2d9e0f60f0c3fb1f15bd5861a9b. DDL c4892b EXIT 0 somente no banco A: 494 migrações reais, 425 tabelas, reserva lógica495. Snapshot novo com 560 linhas e 425 hashes, SHA 9b050bc705535c638ee4b1c470622dc3be08bd9ed22fb13672129267c3e5cb59. Hashes de schema/SQL e perfil local foram conferidos pelo DEV em 45d7f4. A lease foi concedida para os 19 nativos acima e depois liberada. Usar somente o restaurador A495 coordenado pelo ROOT, nunca os antigos A493/A492.

## Pendências

Regressões CRM globais pertinentes e guardas originais em janela coordenada; TypeScript, unitária global, lint original, QA independente, visual e CI. Nativos e global só contam após terminal 0 observado. Não concluída ou homologada.

A composição ROOT contém correções test-only de tipagem da #377 (DOM value, find, union e optional), ainda fora desta base. Não reatribuir os gates antigos ou a seleção independente T 41/579 à seleção DEV 41/566, cuja lista exata não foi recuperada. Nenhum patch de produção #377 foi feito nesta #341.