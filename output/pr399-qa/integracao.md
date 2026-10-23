# PR #399 — C2: integração de escopo das tags

Fonte testada: ab8a2d0599dd5ee89d967e4f4befdf4352d3a1be, head original da PR.
Node22.23.2, executável Vitest local, configuração vitest.integration.config.ts.
Perfil ci-integracao, banco descartável erp_genius_test_ciint, localhost54329.
Nenhuma outra suíte usou esse banco durante a execução. Migrações apenas
conferidas pelo setup; sem instalação, nova migração ou servidor externo.

Executado paineis.int.test.ts inteiro, sem filtro de nome: um arquivo /
12 testes passaram, sessão55608 acompanhada até saída0. O recorte inclui os
três casos novos de tags e os nove casos existentes do painel. Não é suíte
completa de integração.

Com Postgres real, os novos testes conferem ordenação e origem sem autor,
tag historicamente inativa preservada no vínculo, exclusão fora da carteira
comercial e em painel financeiro, restrição de pessoa responsável legal,
convite vigente e retirada do painel após sua revogação. São testes de leitura
com dados fictícios, sem mensagem real ou integração externa.

Nenhuma fonte de produção ou teste foi alterada para obter esse resultado.
C1 HIGH permanece pendente: integrar os pais e main, resolver os conflitos,
obter parecer no head final, retarget e CI verde. Este resultado não homologa
a composição posterior ou os fluxos de interface não executados.
