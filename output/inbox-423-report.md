# #423 — relatório DEV, validade UTC do conhecimento

Publicação: composição d7e55b06 diretamente na main79310013. Dois SRC byteiguais ao DEV/QA6ba2, uma expressão SQL alterada e os seis testes legados preservados. TESTER aprovou4INTcompletos/38,3UNIT/16 e lint2; ROOT TSC ORIGINAL79120/3e69a6 e lintGLOBAL64067/b6d9c7 passaram0,sem exclusões/zeroerros40avisosherdados. Bancos491 restaurados DEV9de0f0 e TESTER22ca79,424hashes e sequências conferidos. [Parecer integral e limites](inbox-423-qa/indice.json). CI e revisão final ainda pendentes; issue423 aberta.

Base main 7931001311476d4381576b8fdf8bba3d0f8e7bb3, branch codex/inbox-ci-423-validade-utc. Ambiente preparado pelo ROOT em 12d01e: cliente próprio 490, perfil ci-integracao e banco ciint491 restaurado (424 hashes/502 registros). A #349 permanece congelada na branch anterior; seus negativos não são reclassificados por esta correção.

## Causa e mudança

Coluna UTC sem fuso era comparada com now() timestamptz, usando implicitamente a TZ da sessão. O produtor altera somente a expressão de validade para now() AT TIME ZONE UTC. API, DTO, ranking, limite, status/arquivamento e IDs autorizados são preservados. Sem Db opcional ou helper compartilhado; sem schema, migração, dependência, instalação, geração ou provedor externo. [SPEC](../docs/specs/aria-validade-conhecimento-utc.md).

O plano privado de 5.351 bytes, SHA b5865d0a5cbda69d3fce9ee599bdafdcb9831314e20f609298d81684659322bf, foi lido/aprovado pelo ROOT em 7d0070 antes do fix. O bridge de teste encaminha o SQL original ao tx real em pool1, sem resultado fake. A coleta da matriz antecede asserções finais e a restauração de PID/TZ é verificada antes delas.

## TDD e gates

RED completo 83578/674d0e: sete casos, cinco passes/duas falhas, 28,05 s, EXIT1, sem filtros/skips. Falham o legado ignora_fonte_vencida e a matriz de três fusos: UTC positivo, São Paulo inclui vencida, Tokyo exclui vigente. Asserções de mesma conexão nos três fusos, três encaminhamentos e restauração passaram antes da comparação negativa. Não houve erro administrativo do bridge.

GREEN completo 65918/c07540: sete de sete, 27,70 s, EXIT0, sem filtros/skips. O produtor mudou uma única expressão SQL entre RED/GREEN; os seis testes legados não mudaram. UNIT dirigido 72db5f: três arquivos/16 casos, 989 ms, EXIT0. Paths: conhecimento/trechos.test.ts, conhecimento/migracao-busca.test.ts e turno/contexto.test.ts. Este resultado é recorte, não UNIT global. O integrador dispensou repetição global DEV para essa expressão SQL; CI global da publicação continua pendente.

TSC auxiliar 32592/25cf96 EXIT0. A configuração privada estende a original e preserva includes/excludes, acrescentando somente as duas exclusões históricas autorizadas: output/inbox-326-a2-diagnostico-private.test.ts e output/inbox-326-package-r8-7a30d4-preservado-private/inbox-326-a2-diagnostico-private.test.ts. Todos os SRC/testes atuais permanecem incluídos. Não se declara TSC original ou lint global verde neste worktree com privados. Lint dirigido dos dois paths f07ef3 EXIT0.

Integração ampliada 70967/aee3e2 EXIT0: quatro arquivos completos/38 casos, 144,15 s, sem filtros/skips e maxWorkers1. Paths: conhecimento/busca.int.test.ts, conhecimento/fontes.int.test.ts, conhecimento/fonte-idempotencia.int.test.ts e turno/contexto.int.test.ts. O banco foi liberado ao ROOT após o terminal; nenhum executor DB permanece ativo.

## Identidade e limites

SHA256 GitLF do produtor antes: 5890cdbf4e8ceab12c285d0c07f39e2650aa80928059803be36558803dff3a90; depois: a7d2fdc3a354b4fed292915ceedef63ab2f2f8c914f3f273aeb4a8c9f4494029. Conferência estrutural 3072/4e4d7f confirmou delta exclusivo da expressão, seis testes antigos preservados e dez paths de orçamento/schema/deps iguais à base. Não foi executada investigação nem alterada a regra de orçamento nesta frente.

Visual N/A, sem UI nova. QA independente, composição, revisão, CI e publicação sob ROOT. Banco ciint491 liberado para restauro pelo integrador; nenhuma operação DB posterior pelo DEV. Não houve ALTER DATABASE, troca de perfil, fuso do cluster ou integração externa.

SHA256 GitLF do teste final: f7e8d4d55fa7354268ab403334a62c238d0fb29d69d1fceeab9345a57ff6524a. Os resultados da #349 permanecem nominais à sua fonte: esta entrega só revalida conhecimento/contexto e não declara o orçamento corrigido ou o recorte Aria global aprovado.

## Restauro confirmado

ROOT confirmou 9de0f0 EXIT0: ciint491, 424 hashes, 502 registros e sequências do snapshot preservados, zero outra atividade. Nenhuma nova operação DB autorizada nesta frente. QA independente, revisão, CI e publicação continuam pendentes; fonte congelada para handoff.
