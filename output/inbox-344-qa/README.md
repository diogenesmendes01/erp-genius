# QA da #344 — filtros e contagens da Aria

A lista e as contagens usam o mesmo contexto de sessão/escopo, com filtros SQL aplicados antes da paginação. A união com main preserva as 31 fontes da entrega e os 3.567 objetos de main fora desse recorte.

Os pareceres são nominais a cada fonte; resultados sobrepostos não são somados:

- [Marco 1](marco1-c9e.md): tradutor fechado de escopo, fonte c9e710e3.
- [Marco 2](marco2-0fd.md): estado/contagens, fonte 0fdedf47.
- [Marco 3, parecer negativo](marco3-713-negativo.md): fonte 7138574b. O oráculo independente encontrou cursores com offset interpretados incorretamente no SQL.
- [Correção do cursor](cursor-d0.md): fonte d0dfa5a3. O instante é convertido para UTC antes dos casts; os 21 casos e o mesmo oráculo independente de 18 combinações passaram. O parecer negativo anterior permanece preservado.

[Composição com main](composicao-main351.json) registra os OIDs das fontes e a união do quadro. [Índice](indice.json) fixa bytes/SHA256 dos quatro pareceres. As integrações anteriores, a correção causal e os gates da composição têm identidades distintas. CI da publicação será registrada após a abertura da PR.

Nenhum log bruto, snapshot de banco, credencial, fixture, ZIP ou imagem integra este pacote.
