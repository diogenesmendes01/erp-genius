# QA #341 — probabilidade e previsão (WIP)

Base: 8096683c5d812e3c61adb8ec452dd47cd6fb46b7. Branch: codex/inbox-e2-341-previsao. #377 permanece recuperável na ref anterior. AGENTS M histórico preservado e excluído da entrega. Nenhum install, generate, DDL, SQL, provider, build, TSC ou teste global executado pelo DEV nesta etapa.

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

SQL ainda não executado: quatro arquivos/19 casos autorados após implementação. São 10 contratos, 5 concorrência/FK/ACL, 1 pool1 e 3 LISTEN real. O interleaving com atribuirDono real usa uma barreira instrumental de chegada após SQL delegado e observará pg_blocking_pids. Não alegar deadlock produtivo ou ausência geral de deadlocks. SELECT 1/0 depois de mutação, Evento e NOTIFY na mesma TX testa rollback real dos três efeitos.

Schema/SQL congelados para revisão ROOT/T: schema SHA 7522228da4465511edbe603d59829f535c3775554cbd931b9b00a7b72608cf22; SQL SHA 4b1f5b4d3594fa581ecf25894f779936b704759c7e945fc7ef06cfb05b1e07d2. O client anterior 72b4825a foi preservado até a preparação exclusiva do ROOT; nenhum cast de produção mascarou campos ausentes.

Infraestrutura pronta pelo ROOT: validate e64939 EXIT 0; generate 97558/dfe8ab EXIT 0; client e251ba321793510fa473b2778f6d4ffd9f0ef2d9e0f60f0c3fb1f15bd5861a9b. DDL c4892b EXIT 0 somente no banco A: 494 migrações reais, 425 tabelas, reserva lógica495. Snapshot novo com 560 linhas e 425 hashes, SHA 9b050bc705535c638ee4b1c470622dc3be08bd9ed22fb13672129267c3e5cb59. Hashes de schema/SQL e perfil local foram conferidos pelo DEV em 45d7f4. Nativos ainda sem lease; nenhum SQL executado pelo DEV. Usar somente o restaurador A495 coordenado pelo ROOT, nunca os antigos A493/A492.

## Pendências

Executar 19 nativos após nova lease e regressões CRM pertinentes; guardas originais em janela coordenada; TypeScript, unitária global, lint original, QA independente, visual e CI. Nativos e global só contam após terminal 0 observado. Não concluída ou homologada.

A composição ROOT contém correções test-only de tipagem da #377 (DOM value, find, union e optional), ainda fora desta base. Não reatribuir os gates antigos ou a seleção independente T 41/579 à seleção DEV 41/566, cuja lista exata não foi recuperada. Nenhum patch de produção #377 foi feito nesta #341.