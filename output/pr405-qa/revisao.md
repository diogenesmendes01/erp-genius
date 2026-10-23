# PR #405 — revisão e integração documental da main

Issue #319. A revisão GitHub R1 `5626077684` aprovou o head `16e3298d9f26d1bdd8ec327bf6acbaec489bb6f3`. C1 MEDIUM pede incorporar a main e resolver o conflito herdado no quadro de entregas. C2 LOW não foi implementado, conforme o escopo autorizado.

## C1

A main consultada por fetch era `cce21e19b25a9785e886081e13f710f576e6d138`. O merge encontrou somente dois conflitos em `docs/planejamento/quadro-entregas.md`, ambos com o lado da main vazio. Foram retirados apenas os seis marcadores de conflito. A conferência `655831`, saída 0, comprovou que o quadro e a árvore inteira resultantes eram byte a byte iguais ao head aprovado, antes deste registro documental. O commit intermediário `b7d36fc113eb1036318bef46b470a5d3b033168f` tornou a main ancestral sem alterar a árvore.

Este registro e a entrada correspondente do quadro são as únicas alterações posteriores. A base publicada #403 (`68e95d8e`) continua ancestral. Nenhum código, teste, script, schema ou dependência foi alterado; os PNGs antigos da #298 permanecem ausentes.

## Evidências e limites

A conferência inicial do head publicado (`d953d1`, saída 0) confirmou a identidade executável com `b8edd5d`, a ancestralidade da #403, a ausência dos PNGs e o diff check limpo. O global do integrador de 903 arquivos / 7.101 testes e o recorte independente do TESTER de 13 arquivos / 212 testes continuam atribuídos às fontes e execuções originais. A R1 relata verificações locais próprias de TypeScript, lint e testes dirigidos; elas não são novos checks de CI.

Esta correção é exclusivamente documental e de ancestralidade. Não repetiu testes, TypeScript, browser, banco ou upload de evidências. A CI final contra main e a integração funcional dos predecessores, inclusive a decisão humana B2 da #392, seguem pendentes. Incorporar a main nesta PR não autoriza ultrapassar as dependências da pilha.
