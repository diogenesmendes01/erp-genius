# PR416 R1 — C3/C4 servidor

Base: 419b694f1f144d3f2dd7b43fcee7ccf470fac6ac. Branch codex/pr416-r1-server. DEV A, worktree exclusivo inbox-dev-a. #327 permanece pausada em b6074f69. Escopo: produtor de menções, helper lexical puro e cálculo do escopo do sino; nenhum frontend, schema, dependência ou parser alterado.

## Contrato e limite

O produtor forma a união por ID dos candidatos relevantes e dos tokens selecionados. O sentinel201 continua sendo avaliado antes dos grupos: mais de 200 relevantes desabilita texto livre, preservando tokens. IDs selecionados sempre passam pela ACL fresca e pela validação original de ID/trecho. Autor, inativo e portal continuam excluídos.

Cada ocorrência livre tem grupos lexicais do alias mais longo para o mais curto. Todos os membros de cada grupo são verificados pela função de ACL existente, na mesma tx; só um grupo sem autorizado permite tentar o próximo. Um grupo ambíguo visível também encerra essa ocorrência. Cache true/false por ID existe somente nesta invocação/tx e é compartilhado com tokens. O extrator original recebe a união dos autorizados e conserva sua semântica. A prova textual d5733e confirmou a função original intacta.

Ganho causal dirigido: entre 200 candidatos Ana, @Ana Silva visível passa de 200 chamadas de ACL no RED d95366 para 1 no GREEN. Não há ACL em lote nem custo constante: @Ana amplo ou fallback após nome longo oculto pode exigir todos os 200; união com 50 tokens distintos pode atingir 250. SQL e funções de permissão não foram copiados/alterados. Sugestões/listagem de candidatos mantêm o comportamento anterior, inclusive limite 20.

O sino calcula escopo apenas no primeiro lote com MENCAO_NOTA/refTipo AtendimentoWhatsApp; reutiliza a Promise nesta chamada e recalcula na próxima. Vazio, só SLA/lembrete e menção com refTipo incorreto não calculam escopo. Lote 100, cursor estrito criadaEm+id, ordem PostgreSQL, ACL por lote e limite 20 visíveis continuam intactos. Não foi criado cache entre chamadas ou atualização realtime do sino.

## Evidências e negativos

- RED inicial e307ec EXIT1: cinco falhas esperadas, quatro do escopo eager e uma de candidato lexical impossível. Não é gate positivo.
- Iteração 37d069 EXIT1: a substituição inicial não encontrou a linha multiline de escopo; quatro asserts apontaram escopo ausente na consulta. Corrigida a ancoragem, sem afrouxar teste.
- RED causal d95366 EXIT1: exatamente o caso200→1 falhou com 200 ACLs; demais 15 passaram. O filtro superset puro era semanticamente seguro, mas insuficiente para esse ganho. ROOT aprovou processamento ACL em fases antes da mudança.
- GREEN5c957d EXIT0: quatro arquivos/54 testes unitários completos, sem filtros/skips. Um dos testes percorre 1.152 combinações geradas (128 subconjuntos ×9 textos), comparando resultado com o extrator original após ACL exaustiva. Essas combinações não são 1.152 testes Vitest individuais.
- TSC final79420/84f670 EXIT0, heap8192. Lint26dc21 EXIT0, sete TS/maxWarnings0. Fonte congelada durante esses executores finais.
- INT48589/d80d91 EXIT0: seis arquivos completos/53 testes em 224,58 s, config integration/maxWorkers1, sem filtro de nome ou skips. Inclui contagem real SQL200→ACL1, pool1, NOTIFY de confirmação, replay sem novo aviso e token incompatível sem nota/aviso/NOTIFY. Todas as conexões/listeners dos testes fecharam.
- Após o terminal INT, somente src/server/inbox/mencoes.test.ts mudou: oráculo ampliado para 4.608 combinações (128 subconjuntos ×12 textos ×3 ordens de candidatos), selected também citado livre, repetições e assert exato a,b/nenhum curto no grupo longo ambíguo. UNIT final317970 EXIT0, quatro arquivos/55 testes, 1,71 s; TSC final00f37a EXIT0 e lint finalee360c EXIT0/sete TS/maxWarnings0. Nenhum produto/INT mudou após48589, conforme manifesto pré/pós.
- AST 1646ea confirmou 12 entradas, 4.608 combinações e acento decomposto real. Sete blobs e SHA256 físico/LF antes/depois estão em pr416-r1-server-fontes.json; somente o blob UNIT reforçado difere. Negativos de constraint esperados aparecem no log INT, com testes rejeitando P2002; não são falhas do gate.

Arquivos UNIT completos: src/server/inbox/mencoes.test.ts, src/server/inbox/consultas-mencoes.test.ts, src/server/crm/notificacoes-mencoes.test.ts e src/lib/mencoes-nota.test.ts. Comando local: node node_modules/vitest/vitest.mjs run <quatro arquivos> --maxWorkers=1 --reporter=verbose.

Arquivos INT completos: src/server/whatsapp/nota-mencao.int.test.ts, src/server/whatsapp/nota-mencao-pool1.int.test.ts, src/server/whatsapp/nota-interna.int.test.ts, src/server/whatsapp/inbox-idempotencia.int.test.ts, src/server/crm/notificacoes.int.test.ts e src/server/crm/lembretes.int.test.ts. Comando local: node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts <seis arquivos> --maxWorkers=1 --reporter=verbose. São recortes pertinentes, não suíte global.

Logs privados: pr416-r1-server-int-r1.log, pr416-r1-server-unit-final.log, pr416-r1-server-tsc-final.log e pr416-r1-server-lint-final.log. Nenhum desses logs é usado como prova de sucesso sem o respectivo terminal0 observado.

## Ambiente e pendências

ROOT preparou cliente A490 (generate36114/3fd35c EXIT0) e prova física/Next2dd03f EXIT0, perfil dev-gravacoes. Banco erp_genius_test_dev_gravacoes490 restaurado17f5d4/424hashes, lease exclusiva A; uma integração por vez. DEV não instalou, gerou, migrou, alterou cluster ou executou notas UI, mensagens reais, providers, push/PR/merge.

QA independente exata, composição com C2 frontend ROOT, regressão integrada, comentários/CI/merge continuam pendentes. Nenhuma homologação visual nova ou conclusão da #327 é presumida. Logs locais não são fontes públicas e preservam negativos separados.
