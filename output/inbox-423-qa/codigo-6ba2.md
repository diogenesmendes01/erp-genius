# QA independente #423 — validade UTC do conhecimento

Parecer favorável ao recorte solicitado no commit exato 6ba2c192cd265d199e1775d31ba054ef36c866cd, pai 7931001311476d4381576b8fdf8bba3d0f8e7bb3.

Ambiente: worktree exclusivo inbox-tester/erp-genius, branch codex/inbox-ci-423-qa, cliente próprio 490, perfil tester e banco descartável TESTER491. READY ROOT cc1143 EXIT0 confirmou snapshot de 1.392 registros/424 hashes, exclusivo para esta execução. Não houve instalação, geração, DDL, alteração de perfil, browser ou provedor externo. O banco foi liberado explicitamente ao ROOT após o terminal da integração; o restauro posterior cabe ao integrador.

## Fonte e análise adversarial

O verificador privado verificar-inbox-423-tester.mjs terminou 297b36 EXIT0. Os cinco paths são dois SRC, SPEC, relatório DEV e quadro. Reverter somente a expressão (now() AT TIME ZONE 'UTC') para now() recompõe byte a byte o produtor anterior. Os seis corpos de teste it existentes permanecem literais; há um sétimo caso. Nenhum outro SRC, Prisma, script, dependência, lockfile ou workflow difere da base. HEAD e tracked limpos foram conferidos.

A coluna de validade representa UTC sem fuso. Explicitar UTC no lado do relógio PostgreSQL elimina a conversão implícita pela TimeZone da sessão. A comparação estrita > permanece, assim como IDs fornecidos, fonte PRONTA, arquivamento nulo, busca textual, ranking, desempate e limite. Não há mudança da política de orçamento, autorização ou contrato público.

O novo teste invoca buscarTrechos pública e real. O spy apenas encaminha sua query e parâmetros ao $queryRaw previamente capturado e vinculado à mesma transação, sem fabricar resultados nem reescrever SQL. Um cliente local connection_limit=1 permite comprovar o PID antes/depois de cada consulta. SET LOCAL usa UTC, America/Sao_Paulo e Asia/Tokyo, com TimeZone e PID verificados nas três zonas. O relógio NOW é estável na transação; fixtures em −1 segundo/+1 segundo e validade nula coexistem com fontes arquivada, PROCESSANDO, ERRO e uma fonte fora dos IDs autorizados. Apenas vigente e sem validade podem retornar. A matriz é coletada antes da asserção final, com três encaminhamentos exigidos.

O mock é restaurado em finally. No caminho saudável, a TimeZone original é restaurada e verificada ainda dentro da transação; um erro SQL evita novo SET em transação abortada e segue para rollback. Em ambos os caminhos, o mesmo pool1 comprova PID/TimeZone originais antes de relançar a falha ou comparar a matriz; o cliente dedicado é desconectado em finally. Não há ALTER DATABASE ou fuso global. O caso não é prova independente da fronteira de igualdade temporal exata: o operador estrito é preservado por identidade da fonte, enquanto os exemplos executados usam ±1 segundo.

## Execuções próprias

Executável local: C:/Users/Mendes/AppData/Local/hermes/node/node.exe. Fonte permaneceu congelada até todos os terminais. Comandos abaixo executados no worktree TESTER, com logs privados adjacentes:

~~~text
node node_modules/vitest/vitest.mjs run src/server/aria/conhecimento/busca.int.test.ts src/server/aria/conhecimento/fontes.int.test.ts src/server/aria/conhecimento/fonte-idempotencia.int.test.ts src/server/aria/turno/contexto.int.test.ts --config vitest.integration.config.ts --maxWorkers=1
node node_modules/vitest/vitest.mjs run src/server/aria/conhecimento/trechos.test.ts src/server/aria/conhecimento/migracao-busca.test.ts src/server/aria/turno/contexto.test.ts --maxWorkers=2
node node_modules/eslint/bin/eslint.js src/server/aria/conhecimento/busca.int.test.ts src/server/aria/conhecimento/busca.ts --max-warnings=0
~~~

Integração: sessão 32391, início 77fc88, terminal 225ccf EXIT0, quatro arquivos completos/38 testes, 150,76 segundos, maxWorkers1, sem filtro ou skip. UNIT: terminal 5c04fe EXIT0, três arquivos completos/16 testes, 959 ms, maxWorkers2, sem filtro ou skip. Lint: e23a2d EXIT0, dois paths, zero warnings permitidos. As advertências de configuração MIXED_EXPORTS e vite-tsconfig-paths apareceram na integração; não houve falha de teste. Cada recorte é nominal e não constitui suíte global.

## Artefatos e limites

SHA256 GitLF do produtor anterior: 5890cdbf4e8ceab12c285d0c07f39e2650aa80928059803be36558803dff3a90; atual: a7d2fdc3a354b4fed292915ceedef63ab2f2f8c914f3f273aeb4a8c9f4494029. Teste atual: f7e8d4d55fa7354268ab403334a62c238d0fb29d69d1fceeab9345a57ff6524a. Neste checkout, os dois arquivos físicos são LF e idênticos aos respectivos blobs Git. A prova de identidade inclui bytes, hashes e os nomes dos seis casos legados.

- output/inbox-423-int-tester.log: 812 bytes; SHA256 1c03a7b0eab27183c98c8287e01cae32465c3b8f77033dd8c089acb9af91e37c.
- output/inbox-423-unit-tester.log: 480 bytes; SHA256 bc77743ee65ef5173c0f425a72b65853fcc097c999202523390521b74db689ff.
- output/inbox-423-lint-tester.log: 0 bytes; SHA256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.
- output/inbox-423-identidade-tester.json: 1584 bytes; SHA256 b1202edf688428221abee3cbcf749984291362f01402d381e8a05bbdcf8292bc.

Gates e sessões: inbox-423-gates-tester.json. Não executei TSC, regressão global ou investigação de orçamento; isso segue o recorte autorizado. RED/GREEN e TSC auxiliar DEV permanecem evidências do DEV, sem reatribuição a esta QA. Os negativos de orçamento/busca da #349 não são convertidos em aprovação global. Visual N/A à alteração SQL. Composição, revisão remota, CI e publicação permanecem sob ROOT; este parecer não presume seu resultado.
