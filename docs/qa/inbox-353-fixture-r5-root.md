# Inbox #353 — revisão C3 da fixture de tags

A fixture de `carregarAriaDoAtendimento` em `paineis-tags.test.ts` fornecia apenas `pausada`, embora o DTO exigisse também motivo, permissões, cartões e handoff. O mock agora usa o DTO completo com `satisfies AriaDoAtendimento`, sem cast. As asserções de escopo e proteção dos dados comerciais permanecem intactas.

Verificação focal `85cba9`, EXIT0: um arquivo completo, 11 testes, sem filtros ou novos skips, UTC, um worker/1024 MiB e provedores externos vazios. Nenhum runtime, regra de permissão, consulta ou schema foi alterado. Não foi repetida integração SQL por esse ajuste de teste. TypeScript/global da composição final permanecem gates próprios, sem reatribuir evidências históricas.
