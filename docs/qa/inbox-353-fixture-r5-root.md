# Inbox #353 — revisão C3 da fixture de tags

A fixture de `carregarAriaDoAtendimento` em `paineis-tags.test.ts` fornecia apenas `pausada`, embora o DTO exigisse também motivo, permissões, cartões e handoff. O mock agora usa o DTO completo com `satisfies AriaDoAtendimento`, sem cast. As asserções de escopo e proteção dos dados comerciais permanecem intactas.

Verificação focal `85cba9`, EXIT0: um arquivo completo, 11 testes, sem filtros ou novos skips, UTC, um worker/1024 MiB e provedores externos vazios. Nenhum runtime, regra de permissão, consulta ou schema foi alterado. Não foi repetida integração SQL por esse ajuste de teste. TypeScript/global da composição final permanecem gates próprios, sem reatribuir evidências históricas.

## Correção do escopo do backport

O primeiro backport copiou também o mock de tarefas da composição posterior, cujo módulo não existe na base desta PR. A filha reconstrói o teste a partir da base exata `02ca1895`, acrescentando somente o import de tipo, o DTO completo e seu uso no mock. As linhas e asserções anteriores permanecem intactas; o mock de tarefas fica exclusivamente nas PRs que o introduzem. A verificação focal da composição não é reatribuída a esta filha. QA no SHA exato concluída conforme recibo abaixo.

QA independente na filha `d3733ff077330a664826d961633911d79f510421`: terminal `2576ca`, EXIT0, arquivo completo/11 testes, UTC/w1/1024, sem filtros ou novos skips. Parecer SHA256 `6aea653a698ed18bcc39207265a659baeb22b188fba695536b7c745510f283b1`; log SHA256 `629d1d8b5a728753feaca9f10b2cd0e1143b5fc28f655b6b0b6173d980999dc1`. TESTER confirmou runtime literal à base02ca, somente import/DTO completo/uso no mock e todas as assertivas preservadas. Nenhum mock de tarefas330; perfil/client/bundle preservados. Não houve SQL nem TSC nessa QA.
