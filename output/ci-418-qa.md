# QA independente da correção #418

O [parecer inicial integral](ci-418-qa/d9-original.md) está preservado com seus bytes originais: SHA256 a29dd0396bcc52d8417fca79abd3d0feb3afea08afb513f350bd118108264c9f, 7.468 bytes. É favorável ao código d9c1d0bb, anterior à correção da corrida adicional identificada na R1 da PR #419. Esse parecer não homologa a nova correção.

Na fonte inicial, o TESTER executou dois arquivos completos/37 testes unitários e dois arquivos completos/40 testes de integração, TypeScript e lint de quatro fontes, todos com saída terminal 0. A integração usou um banco descartável local, motor simulado, um worker e durou 138,00 s. O banco foi liberado e restaurado pelo integrador, com os 424 hashes e os 494 registros originais conferidos.

A análise estática da R1 confirmou que o webhook pode persistir DESCONECTADO antes da transação administrativa, sem registrar o evento de desconexão. A correção e a QA independente atualizada permanecem pendentes de validação neste registro. A cobertura anterior de CAIU e rollback continua nominal à fonte inicial; não substitui os novos casos de webhook.

Não houve motor real, envio de mensagem ou deploy. Os recortes unitários e de integração são distintos e não equivalem à suíte global. CI rápido, Integração remota, comentários e merge são acompanhados separadamente.
