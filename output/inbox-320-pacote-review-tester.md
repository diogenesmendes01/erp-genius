# QA independente do ZIP local #320

**Parecer:** favorável ao pacote ZIP **local** output/inbox-320-evidencias-442d.zip. A auditoria somente leitura terminou com código 0. Fonte visual de todos os grupos: 491de47c06403c96724b09701bbc20a187d1ae59; fonte integrada declarada no manifesto: 442d1a665e82c7376ce7e8707b3a4d365257c7db. Este parecer verifica a embalagem e a rastreabilidade dos artefatos; o roundtrip remoto pertence ao integrador.

## Verificações próprias

- ZIP de **23.677.284 bytes**, SHA-256 d4f0168d80a248b081adaa1fabca426b789734aee7b0d0c53cdcdfe54cf5c0a4; sidecar contém exatamente esse hash e o nome do ZIP no formato binário sha256sum.
- **272 entradas**: 264 PNG, 6 Markdown e 2 JSON (tabela e manifesto). O manifesto declara os outros 271 arquivos; cada entrada tem tamanho e SHA-256 iguais aos declarados. Não há entradas extras, nomes repetidos (inclusive por caixa/normalização Unicode), caminho absoluto, travessia de diretório, barra invertida, symlink, entrada vazia ou extensão/tipo proibido. As 264 assinaturas PNG foram conferidas.
- Grupo formal: **164 PNG / 16.777.708 bytes**; allowlist original SHA-256 2397b2ae4a6e83fdfe6c02ef3685814fe2ab868a8fbf8788dd73ba8118c02025.
- Grupo complemento: **88 PNG / 6.544.458 bytes**; allowlist original SHA-256 54a54dcaba9ee4d995d0df87029e4ed077ce2ecf320f90f7dc53d7a84051d22f.
- Grupo TESTER: **12 PNG / 863.247 bytes**; allowlist original SHA-256 dcad80b80d8290866a946f452f9768fdae3e3e450548e72d065fa8a194d26fad.
- Em cada grupo, a fonte 491de47c06403c96724b09701bbc20a187d1ae59, o caminho de origem, os bytes e o hash de cada PNG batem com a allowlist original, com o arquivo físico de origem e com a entrada descompactada do ZIP.
- A tabela comparacao-app-prototipo.json tem **100 linhas sem chave de estado duplicada**: 100 imagens APP, 64 referências de protótipo e **36 N/A** com motivo preenchido. São seis N/A em cada estado carregando, painel-erro, thread-erro, painel-vazio, busca-conversa e sem-selecao. Suas 164 referências são distintas e correspondem **um a um** aos 164 PNGs formais. Todas as linhas citam a fonte visual correta.
- Há **14 pares de PNGs byte-idênticos** sob nomes de estados diferentes, todos no grupo formal e presentes nas allowlists originais. Isso reflete capturas semanticamente sobrepostas; não é duplicação de caminho ou acréscimo não declarado. Nenhum par cruza grupos. A contagem contratual de 264 PNGs representa arquivos/estados, não 264 conteúdos binários únicos.

O verificador próprio reproduzível está em output/qa-320-auditar-zip-tester.ps1; execução terminal **código 0**. Também foi conferida separadamente a bijeção entre tabela e grupo formal, com 164/164 referências e 100/100 chaves semânticas distintas, código 0.

**Limites:** esta rodada não reexecutou aplicação, banco, testes ou inspeção visual; esses aceites constam dos pareceres anteriores na fonte 491de47. Não executei upload nem download do release draft e não reivindico roundtrip remoto. Os documentos Markdown foram validados como entradas permitidas e por tamanho/hash no manifesto, sem homologação editorial nova.
