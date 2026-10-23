# QA independente de composição — PR #407

Fonte exata: `57530e8c3fc298400b63f0fc0fd22c4919ea97fb`, merge de `3258ff4e352477e66bc889b41122a5a39d0e5140` (#321) e `21979a823a6a2488acd2358c3885868c0dd9b6cd` (#406 composta). Parecer estático favorável, sem bloqueio alto ou médio novo.

- `git rev-parse HEAD` confirmou o SHA; rastreados limpos. O diff de `src` contra #406 contém exatamente seis caminhos de #321: `src/server/inbox/aviso.ts` e INT, `permissoes.ts` e unitário, `src/server/aria/permissoes-tela.ts`, `src/server/whatsapp/acoes-atendimento.ts`. Os seis OIDs são idênticos aos pais `3258` e à fonte #321 `9d0225b4da449159e755448945bc1c89f1b61355`, anteriormente revisada; não houve adaptação de autorização ou payload no merge. `git diff --check -- src` terminou 0.
- App, componentes, harness moderno, guardas/testes gerais, scripts, schema/migrações e package/lock são byteiguais à base #406 (`git diff --quiet`, exit 0). Planos #297, E2E, `.github` e `src/test` também iguais à base (exit 0). Assim o merge não escolheu uma árvore antiga que substituísse o Inbox atual, nem trouxe código/schema futuros #322/#323.
- Os blocos documentais de #405/#406 e da preparação E2/#321/#322 permanecem no quadro. A SPEC de aviso/capacidades de #321 entra como documento; os conflitos não exigiram alterar os seis produtores/testes.

Não executei unitários, TSC, lint, integração, DB ou browser nesta extensão. O publicador conduz os gates do head e os dois arquivos INT aviso/participantes-aviso no banco `ciint` exclusivo. A QA exata da #321 no SHA `9d0225...` é a referência funcional, mas não substitui os resultados terminais da composição/CI. Não atribuo esses gates externos a este TESTER.
