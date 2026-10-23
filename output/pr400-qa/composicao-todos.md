# PR #400 — integração dos comentários e correções anteriores

Fonte cb89727a0fd9d12f64b0e4e8ddedb5c21752ace3. O patch isolado616496 (somente JSDoc e documentação) foi aplicado sobre o head publicado3b como17fcdac0. A candidata398794191c5 foi incorporada por merge local, preservando main3401, QA280, B2 e as correções de dias/autoria da thread. Publicação e merge aguardam397/398 na main; nenhum código de319 ou E2 foi antecipado.

C1 HIGH/C6 LOW: seis blocos do quadro preservam ambos os lados. README mantém os estados e contagens313, a portabilidade B2 e um único bloco de anonimização; duas regiões de conflito foram resolvidas literalmente. InboxNovo.interacao.test.ts mantém integralmente a versão400/17fcdac0, com os testes de rota, ColunaConversas, leitura e ACK. O lado314 ainda usa o componente antigo de lista e não traz nova regressão de398 nesse arquivo; as alterações de398 estão nos dois componentes/testes da thread, idênticos794. Provas1b5303/d3a635 terminaram0. O conflito não motivou remover testes400 nem sobrescrever InboxNovo.

C2 MEDIUM: a integração histórica de leitura e presença permanece nominal260a4599, dois arquivos/20 testes, terminal0, perfilci-integracao. A comparação022ca3 confirmou ambos os arquivosINT byte idênticos; preferencias.ts difere somente no JSDoc @deprecated do alias. A execução atual não é uma nova suíteDB e não há integração externa ou envio.

C3 LOW: alias legado documentado sem mudar a política de revalidação. Parecer independente616 favorável confirma emit JS idêntico. C4 LOW: inventário/curadoria e referências dos artefatos preservados no relatórioDEV. C5 LOW: SPEC alinha o h1 Conversas e singular/plural já implementados; nenhum novo comportamento de título foi criado.

## Gates próprios

- Recorte na composição cb897:12 arquivos/208 testes, America/Sao_Paulo, maxWorkers2, terminal0 b514c0. Sem filtro de caso/skips novos, não é global nem DB. Inclui leitura automática, atualização em lote, interaçãoInbox, Coluna, Conversa, dias/balão, guardas visuais e dependências.
- Next typegen/TypeScript sessão94403, terminal0 em8be42f. Lint global sessão21031, terminal0 em3bba19: zero erros/40avisos herdados.
- Manifestos/lock/ESLint/guardas iguais794 e patch398 preservado. Backend igual17, exceto as anotações herdadas já declaradas. Nenhuma instalação, migração, seed ou captura.

Global879/6.894 permanece nominalc221bdb3; visualizações313 e complemento394 mantêm seus commits/fontes históricos.

## QA e integração complementar

QA independente cb897/e704 é favorável, por comparação estática dos objetos: alias/INT/filtros/Coluna/InboxNovo.interacao iguais17; JS de InboxNovo igual17; thread e dependências iguais794. Não executou novos testes/DB. Parecer original SHA256 d54649b2d5e9d1705f93fb1aa59ef0bf6f70a671cc453d989593ff9c85bf409a, copiado em tester-composicao-cb.md com apenas EOF normalizado. O parecer da predecessora39870ec também é preservado, SHA256 f669cafa127b1577a02906e73699a2f1a6bfc652e90d37ecd0beb9f150265100.

Complemento de integração nominal à candidata399 a5ecee15: preferencias.int.test.ts e whatsapp/motor/presenca.int.test.ts (20 casos), junto de crm/tags.int.test.ts (10 casos), três arquivos/30testes, America/Sao_Paulo, configintegration, maxWorkers1, terminal0 81795/9f1ea7. Banco exclusivo ci-integracao/erp_genius_test_ciint em localhost54329; setup só confere migrations, nenhuma suíte simultânea ou mensagem externa. Ambos os arquivos INT e preferencias.ts são byte idênticos entre a5ece e esta candidata400; a execução pertence explicitamente à fontea5, não é global nem uma nova execução neste head400. A integração do painel399 foi uma execução separada, não faz parte dos20casos400.

Incorporação dos documentos/ancestralidade397main e39870ec em332f3cb1 preservou todos os executáveis de cb897 (bd9a64, terminal0); um conflito do quadro manteve ambos os lados. CI global final contra main nos dois fusos e merge posterior à398 continuam gates obrigatórios.
