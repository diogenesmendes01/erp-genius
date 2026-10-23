# PR #400 — integração dos comentários e correções anteriores

Fonte cb89727a0fd9d12f64b0e4e8ddedb5c21752ace3. O patch isolado616496 (somente JSDoc e documentação) foi aplicado sobre o head publicado3b como17fcdac0. A candidata398794191c5 foi incorporada por merge local, preservando main3401, QA280, B2 e as correções de dias/autoria da thread. Publicação e merge aguardam397/398 na main; nenhum código de319 ou E2 foi antecipado.

C1 HIGH/C6 LOW: seis blocos do quadro preservam ambos os lados. README mantém os estados e contagens313, a portabilidade B2 e um único bloco de anonimização; duas regiões de conflito foram resolvidas literalmente. InboxNovo.interacao.test.ts mantém integralmente a versão400/17fcdac0, com os testes de rota, ColunaConversas, leitura e ACK. O lado314 ainda usa o componente antigo de lista e não traz nova regressão de398 nesse arquivo; as alterações de398 estão nos dois componentes/testes da thread, idênticos794. Provas1b5303/d3a635 terminaram0. O conflito não motivou remover testes400 nem sobrescrever InboxNovo.

C2 MEDIUM: a integração histórica de leitura e presença permanece nominal260a4599, dois arquivos/20 testes, terminal0, perfilci-integracao. A comparação022ca3 confirmou ambos os arquivosINT byte idênticos; preferencias.ts difere somente no JSDoc @deprecated do alias. A execução atual não é uma nova suíteDB e não há integração externa ou envio.

C3 LOW: alias legado documentado sem mudar a política de revalidação. Parecer independente616 favorável confirma emit JS idêntico. C4 LOW: inventário/curadoria e referências dos artefatos preservados no relatórioDEV. C5 LOW: SPEC alinha o h1 Conversas e singular/plural já implementados; nenhum novo comportamento de título foi criado.

## Gates próprios

- Recorte na composição cb897:12 arquivos/208 testes, America/Sao_Paulo, maxWorkers2, terminal0 b514c0. Sem filtro de caso/skips novos, não é global nem DB. Inclui leitura automática, atualização em lote, interaçãoInbox, Coluna, Conversa, dias/balão, guardas visuais e dependências.
- Next typegen/TypeScript sessão94403, terminal0 em8be42f. Lint global sessão21031, terminal0 em3bba19: zero erros/40avisos herdados.
- Manifestos/lock/ESLint/guardas iguais794 e patch398 preservado. Backend igual17, exceto as anotações herdadas já declaradas. Nenhuma instalação, migração, seed ou captura.

Global879/6.894 permanece nominalc221bdb3; visualizações313 e complemento394 mantêm seus commits/fontes históricos. QA composta e CI global final contra main nos dois fusos ainda são gates, sem reatribuir execuções antigas a este head.
