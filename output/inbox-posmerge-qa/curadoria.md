# QA independente — curadoria textual pós-merge

Fonte exata: `272a2b33452944d77b5f1e6ed2a750981f57c1bf`, pai `6dfa809d5120324725812b60dc8ff7896d816d6d`. **Parecer favorável**, sem achado alto ou médio. É revisão estática/proveniência, sem teste de aplicação, banco, browser ou captura.

O delta contém exatamente **35 arquivos**: 33 registros históricos com blob anterior, um README novo junto ao manifesto TESTER e o catálogo; também modifica SPEC/quadro e acrescenta somente JSDoc a `prazo-vivo.ts`. Fora desse comentário, nenhum arquivo executável, schema, script ou dependência mudou.

Auditoria própria `output/qa-auditoria-posmerge-textos-tester.py`, executor `85c356`, **exit 0**: 34 registros catalogados; para **33/33** originais, OID Git, SHA-256 e tamanho conferem com o commit pai e com o backup físico local ROOT em `output/qa-private-history/posmerge-20261023/textos`. Para **34/34** curados, SHA-256/tamanho conferem com os **blobs versionados** do commit revisado. O working tree Windows pode converter LF para CRLF; por isso os hashes curados foram conferidos pelos blobs Git, não pelos bytes da cópia de trabalho. Dos 33 registros, 29 mudaram; quatro logs TSC vazios continuam com 0 bytes.

Os **16/16 logs** passam por transformação exata dos bytes originais: CRLF→LF, prefixo pessoal do workspace→`<workspace>` e EOF normalizado. Nenhuma linha de diagnóstico, contagem, teste ou resultado mudou. Os **5/5 manifestos** mantêm todas as propriedades e valores anteriores e acrescentam somente `curadoriaPosMerge`; os avisos dizem expressamente que as capturas são históricas. Os README preservam o relato anterior e adicionam a ressalva de curadoria, sem atribuir testes novos.

O mapa Task 8 aponta para **3/3 nomes reais** em `BalaoMensagem.test.ts`, e o mapa Task 3 para **5/5 nomes reais** em `consultas-pagina.int.test.ts` e `nota-interna.int.test.ts` (oito consultas `rg -F`, todas exit 0). A referência corrigida da revisão #390 aponta para `output/inbox-painel-keys-visual/depois/`, que contém as 20 PNG citadas mais dois manifestos; o índice sanitizado #307 existe e registra o mesmo asset/hash citado pelos avisos. No quadro, o metadado de 21/09 foi deslocado literalmente para o início e os demais ajustes são espaços; os resultados históricos permanecem atribuídos às execuções originais. No HTML do protótipo, o único delta é a linha 539 em branco.

O JSDoc de `prazo-vivo.ts` não muda o JS: transpile do TypeScript local 5.9.3, `removeComments:true`, emitiu **2.468 bytes iguais** e SHA-256 `61e62c78ba811a91fab2d575f6c195ef1126cddbff4a36442e270b48c15e4f81` antes/depois (executor `f0179e`, exit 0). Rastreados limpos no worktree TESTER (executor `2d81d0`, exit 0).

Limites: backup examinado **localmente** em modo leitura; nenhuma publicação/roundtrip remoto nem nova execução dos testes antigos foi verificada ou alegada. Os scripts de auditoria próprios permanecem privados em `output/` e não integram o commit.
