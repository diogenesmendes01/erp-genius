# Inbox #334 — composição e verificação R5

Candidata DEV `63b0df3a514e087782a112aa84ed28303cdd5ebb`, composta sobre a base publicada da PR #443 (`5c9a6b18a892f0fa35ca5ca23487ca8268c0c770`) no merge local `05bb5a6d18f035cd9d7a5dc8c70d13469adaa724`. Os 23 arquivos funcionais chegaram literais à candidata; somente o quadro precisou de resolução, preservando os parágrafos dos dois pais. Nenhum conflito de código.

QA independente na candidata: integração `40986/862e18`, EXIT0, quatro arquivos completos/83 testes, 331,50s; UNIT `75910/c2a900`, EXIT0, 26 arquivos/701 testes; oráculo próprio `03b0a0`, EXIT0, 14 casos. Sem filtros ou novos skips, UTC/w1/1024. Os recortes se sobrepõem e não são somados. Parecer SHA256 `ee3fc5733cd2bef8d93b0e0a877d9508c7abeae602690886d9f183d3fb9e8c99`. O banco do TESTER foi restaurado em `498be0`, EXIT0, 1393 registros originais/424 hashes, sem SQL posterior.

O TypeScript original da composição com a fixture corrigida (`35cdfe90`) terminou `60067/d32f5b`, EXIT2: TS7022 em `lote` e `ultimo`, no leitor paginado. A correção explicita os tipos Prisma já retornados: `AcaoAgenteIA[]` e `AcaoAgenteIA`, sem casts nem alteração da consulta. Também acrescenta LF no fim do arquivo; não se afirma identidade byte a byte removendo somente as anotações. O TESTER confirmou que o diff se restringe às duas anotações e ao LF final.

Replay original `72946/c02852`, EXIT0, `tsc --noEmit --incremental false`, teto8192 MiB. Executado na fonte de trabalho corrigida, antes do commit, com SHA256 `f9f68424e5fd626f9094a526dea80d283c3830b99a967b2847b6f11ec3879e1d`; fonte e configurações permaneceram intactas durante a execução. Não é execução no HEAD anterior. Sem exclusões novas ou configuração alternativa. SQL83 não foi repetida por anotações apagáveis; a evidência continua atribuída à candidata original.

Global/lint finais, build/CI e aceite visual APP/PROTO permanecem pendentes. Nenhum fechamento de issue, homologação visual ou merge em main é presumido.
