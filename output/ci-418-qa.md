# QA independente da correção #418

**QA atual favorável à R1 `6039755842dbbe946ba19d0436436a23dd930ce9`.** O [parecer R1 integral](ci-418-qa/r1-6039.md), 7.491 bytes LF, tem SHA256 `C5943BAEB966B058D32958B2ABCB73FD51160DCFFEF1950A924522B00A07175E`. Provas próprias: dois arquivos/37 UNIT, dois arquivos/46 INT, TypeScript e lint de quatro fontes, todos com saída terminal 0. A integração durou 217,57 s, com um worker e motor simulado. O ROOT restaurou o banco depois, em cd77db, conferindo os 424 hashes e o snapshot original de 494 registros. Integração remota no head final e merge ainda pendentes.

O [parecer inicial integral](ci-418-qa/d9-original.md) está preservado com seus bytes originais: SHA256 a29dd0396bcc52d8417fca79abd3d0feb3afea08afb513f350bd118108264c9f, 7.468 bytes. É favorável ao código d9c1d0bb, anterior à correção da corrida adicional identificada na R1 da PR #419. Esse parecer não homologa a nova correção.

Na fonte inicial, o TESTER executou dois arquivos completos/37 testes unitários e dois arquivos completos/40 testes de integração, TypeScript e lint de quatro fontes, todos com saída terminal 0. A integração usou um banco descartável local, motor simulado, um worker e durou 138,00 s. O banco foi liberado e restaurado pelo integrador, com os 424 hashes e os 494 registros originais conferidos.

A análise estática da R1 confirmou que o webhook pode persistir DESCONECTADO antes da transação administrativa, sem registrar o evento de desconexão. A nova QA verifica a correção com evento único/autor, repetição, rollback após webhook já confirmado e número inicialmente desconectado. A cobertura anterior de CAIU e rollback continua nominal à fonte inicial; os novos casos de webhook estão identificados no parecer R1.

Não houve motor real, envio de mensagem ou deploy. Os recortes unitários e de integração são distintos e não equivalem à suíte global. CI rápido, Integração remota, comentários e merge são acompanhados separadamente.
