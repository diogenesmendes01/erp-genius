# QA #327

Estado atual: revisãoR1 sobre668, com cinco fontes em [revisao-r1.json](revisao-r1.json). UNIT dirigido, lint5 e TypeScript original passaram; QA exata e integração na main seguem pendentes. A identidade44objetos/9a8 abaixo é histórica anterior ao patch.

[Porte e identidade](composicao.json), [índice e limites](indice.json), [QA dinâmica](porte-dinamica-9a8.md), [QA estática](porte-estatica-9a8.md), [curadoria](curadoria-fd6.md) e [operação visual A11](a11-operacional-visual.md).

A nova fonte9a8 passou em947arquivos/7.742UNIT,TypeScript original,lint43 e seteINT/67 DEV. TESTER executou17UNIT/460 e os mesmos seteINT/67 completos;recortes não se somam. Bancos491 restaurados pelo integrador.

O corpus18 é histórico,com fontes/qualificações individuais no [manifesto visual](manifesto-visual.json). ZIP/PNG estão preparados e verificados,mas aguardam autorização/publicação. Não são capturas da nova árvoreMain. A fundação328 é parcial e a dependência326 não foi mergeada. CI e revisão final continuam pendentes.


## Revisão R1: portabilidade dos originais e cabeçalho opcional

O finding B1 é real: os pinos físicos CRLF do Windows recusavam os blobs LF no Linux. As conversões completas nos dois sentidos provaram que só os finais de linha diferem. A guarda anterior ao browser e a exceção estrita de console passam a admitir somente os hashes raw exatos das duas representações conhecidas, sem normalizar o arquivo servido ou editar os originais. O manifesto conserva o hash físico real; o corpus anterior continua nominal às fontes físicas originais. Não houve recaptura nem execução de browser real nesta correção.

C3: sem cabeçalho, a aba recebe todas as capacidades negadas. As regressões ausente/nulo falharam antes da correção e o controle positivo preserva as capacidades recebidas. B1 GREEN2arquivos/24 e C3 GREEN3arquivos/132, sem filtros/skips, são recortes diferentes e não são somados. Lint5 EXIT0; TypeScript original9539/74fac3 EXIT0, Node22heap8192/noEmit/incrementalfalse, semconfigaux/exclusões extras; QA final ainda pendente. [Prova e fontes R1](revisao-r1.json).

[Integração completa668](ci-full-668.json):357arquivos/3.185testes aprovados, três arquivos/quatro opt-in ignorados, quatro shards. Essa execução antecede o patchR1 e não é uma nova integração dele. Backend/schema/contratos de transação não foram alterados pelo patch. A prova composicao.json de44objetos permanece nominal ao porte anterior; os cinco deltasR1 têm hashes separados. Dependência326, autorização/publicação de anexos, composição com main e merge continuam pendentes.


A [composição candidata com 326/344/345](composicao-345-candidata.json) preserva 40 objetos literais e combina quatro compartilhados, incluindo os testes de resumo e alçada do Funil. Treze arquivos passaram (258 testes), sem capturas nativas. Preparação local: nova CI e os gates de dependência e anexos continuam pendentes.
