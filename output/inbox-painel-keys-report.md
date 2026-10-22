# Inbox — identidades dos componentes do painel

Durante as capturas E0, o React avisava sobre filhos irmãos com chave duplicada ao selecionar atendimento. TESTER confirmou em10/10 estados selecionados e0/10 sem seleção; também ocorria na base anterior às issues301/304. DEV B localizou PainelAria e AcoesContato usando o mesmo atendimentoId como key. Não era duplicação da lista/SSE.

As duas keys recebem prefixos distintos e continuam mudando ao trocar o atendimento, preservando a reinicialização dos componentes. Sem mudança de layout, regra de negócio, schema, permissões ou transporte.

Teste determinístico no harness existente monta ambos os painéis no aside/Drawer: RED1falha/20verdes (keys a1/a1); GREEN21testes exit0. Na primeira rodada TSC apontou ausência de key no tipo estreito No do helper; a asserção passou a usar ReactElement, sem alterar helper. Rodada final Node22.23.2 sessão82909:21testes, TSC global com tiposNext e lint dos2arquivos, todos código0. Revisão independente e confirmação no navegador pendentes antes de publicar.

A regressão completa E0 anterior a este ajuste de2linhas foi845arquivos/6526testes, código0 no SHA7657c528; não é atribuída como execução após o ajuste. Nenhuma integração externa ou deploy.
