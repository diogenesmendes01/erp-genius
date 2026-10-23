# PR #400 — C2: escrita da leitura automática

Fonte260a4599ca754c5a6ad6854d8bd753ca250d97d2, head original da PR.
Node22.23.2, Vitest local e vitest.integration.config.ts, perfil ci-integracao,
banco descartável erp_genius_test_ciint, localhost54329. Nenhuma suíte
concorrente nesse banco. Setup apenas conferiu migrações/dependências.

Arquivos completos preferencias.int.test.ts e motor/presenca.int.test.ts:
dois arquivos /20 testes passaram, sessão44027 acompanhada até saída0,
sem filtro ou ignorados. Não é suíte completa de integração.

Os cenários da escrita automática verificam persistência pessoal/compartilhada,
rejeição fora de escopo, falha parcial sem perder a preferência pessoal e
ausência de revalidatePath. Os caminhos manuais preservam a invalidação
esperada. No motor, os testes verificam o comando message.read simulado e
o contador persistido, incluindo sessão desconectada e falha do motor.
A execução usa Postgres real e mocks de autenticação/cache/motor; nenhuma
mensagem ou requisição foi enviada a um provedor externo.

Produção e testes permaneceram inalterados. Este commit registra somente
o quadro e este relatório. C1 HIGH de ancestralidade/main, dependências e CI
do head final continua pendente; não homologa a composição posterior.
