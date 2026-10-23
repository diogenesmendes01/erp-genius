# QA independente B2/#392 — commit composto

**Fonte exata:** c7bae481f099fc3c7d237b9fe81132c89968d948 (merge de 68974544ec64363255f30111ffd0074f8f478907 com main cce21e19b25a9785e886081e13f710f576e6d138). **Parecer:** favorável ao B2 no recorte estático/Node22 próprio. Não é execução própria de integração, Chrome ERP, global ou CI.

## Contrato e composição

A diferença de src/ e scripts/ contra a main contém exatamente 14 caminhos próprios do harness: dez em scripts/visual e quatro em src/test. Comparei os 14 OIDs individualmente com o patch B2 isolado 68974544: zero divergências. src/app, src/components, src/server, src/lib e scripts/test-profile.mjs não diferem da main nesse merge. package.json, package-lock.json e eslint.config.mjs são byteiguais aos do patch B2 isolado. A CLI exige PW_CHROMIUM explícito para qualquer captura e não seleciona fallback Linux antigo; --help não abre browser ou banco.

O guard confere dependências diretas contra o lock e a resolução real createRequire de @playwright/test → playwright → playwright-core, além do core direto do harness. O recorte cobre versão aninhada divergente e cópia física equivalente. No ambiente TESTER, o resolvedor Node22 encontrou test, runner, core aninhado e core direto todos em 1.64.1. O preflight real do repositório passou. Comparei o lock desta fonte com o commit #280 bab2c9f9: versões 1.64.1 e integridades SHA-512 dos três pacotes Playwright são idênticas. O resíduo textual é @babel/standalone 7.29.0, necessário ao protótipo HTML offline e ausente no lock daquele commit; isto não autoriza declarar merge-tree limpo com #280.

O integrador já havia alinhado fisicamente somente node_modules do TESTER. Auditei em leitura os 115 arquivos atuais de playwright-core: todos os tamanhos e SHA-256 coincidem com inventarioNovo do manifesto local, sem arquivo extra no diretório; o backup físico anterior 1.56.1/340 arquivos permanece presente. Não instalei, movi, regenerei nem editei dependências.

## Execuções próprias

- Node v22.23.2: src/test/dependencias.test.ts e src/test/visual-inbox.test.ts completos, maxWorkers2. Chunk 49758b, terminal **exit 0**, 2 arquivos/20 testes (guard6 + visual14), sem skips reportados.
- node --check scripts/visual/capturar-inbox.mjs, CLI --help e execução real de conferirDependenciasInstaladas() por tsx local. Chunk f049b9, terminal **exit 0**; saída preflight real: OK. A mesma execução confirmou package/lock/ESLint iguais ao patch isolado e diff rastreado limpo.
- Resolução real do Node test→runner→core aninhado + core direto: chunk 74a2ac, **exit 0**, quatro versões 1.64.1. Auditoria física dos 115 arquivos: chunk f05d83, **exit 0**, zero divergências.
- Contagem/OIDs dos 14 arquivos e preservação do código de aplicação: chunk ab949b, **exit 0**, 14 caminhos/zero OIDs diferentes e diff de aplicação zero.

**Limites:** não executei banco, integração visual, Chrome, download de navegador, recaptura ERP, global nem CI. Os resultados já relatados pelo outro integrador pertencem a ele. A auditoria confirma compatibilidade de versão/integridade com #280, mas não afirma integração automática sem conflito textual. Nenhum arquivo de produção, script ou dependência foi editado por esta QA.
