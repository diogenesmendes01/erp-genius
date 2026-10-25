# #357 — barreira do portal após espera

A correção usa `apenasPortal` no início de `contextoAssumirAria`, antes de consultar o banco ou aceitar o responsável atual. O DTO e a mutação compartilham esse helper; `conferir` já fornece o usuário fresco lido na transação após as esperas. Não foi criada uma lista nova de papéis, consulta global de sessão ou exceção de permissão.

ALUNO exclusivo é recusado mesmo com convite legítimo e responsabilidade atual. `[]` e ALUNO+VENDEDOR preservam a semântica canônica. Locks, retry MAX3, cancelamentos e idempotência permanecem literais ao pai. Os JSDocs foram recolocados nas actions correspondentes, sem alteração do código da API legada.

## Fonte e proveniência

Entrada: `360858dc8616cc3a051d4ca30860f5491e21ea2f`, na branch `codex/inbox-e3-357-portal-hardening`. O pai contém a revisão #334 e o checkpoint privado `76f9` de dois arquivos de schema. ROOT deve integrar somente o delta do hardening, sem publicar os pais privados.

O achado do TESTER foi reproduzido com o mesmo blob de `assumir-aria.ts` da fonte 708: `c26583927be6a4bce2bbf4181fac022dd2a6e4fc`. A diferença de hash no filesystem vem dos finais de linha. O oráculo foi copiado byte a byte para o próprio B: SHA256 `8196db7b39cdc35143a40eea3a9cd9a3d88ed8262bd26db4a312a58b7ea567d8`. A configuração privada também foi copiada sem adaptação: `77a6bb4ea6fc5726f6e6867da0dd560ddae6269226b4854fec97f8098a10fc5b`. O caminho relativo das observações resolve para o B, com absoluto distinto do TESTER. Nenhum arquivo do outro worktree foi editado.

Após executar, as cópias privadas do oráculo e da configuração foram preservadas como `.txt`, com bytes iguais, para não adicionar arquivos históricos ao TypeScript futuro. Logs e observações RED/GREEN ficam separados. A proveniência está em `output/inbox-357-portal-oracle-proveniencia-private.json` (SHA256 `4094b7273399a1790124afcb718d2e438a12419a236db9db373f37eab1c32abe`).

## RED e GREEN observados

O oráculo começa com ADMINISTRADOR, responsável atual e convite legítimo. Um holder retém o Atendimento com `FOR NO KEY UPDATE`; a espera da action é observada por `pg_blocking_pids`. Só então o papel muda para ALUNO. A fixture não retira o convite, não desativa o usuário e não troca o responsável.

- UNIT RED `27d736`: EXIT1, uma falha e nove controles verdes em dois arquivos. UNIT GREEN `728dbe`: EXIT0, 2 arquivos e 10 casos. Cobre ALUNO antes de qualquer consulta, `[]`, papéis mistos, vendedor e professor convidado, outro responsável/grupo e os erros que não podem receber retry de phantom.
- Oráculo nativo RED: sessão `30130`, terminal `612418`, EXIT1; um controle ERP passou e o portal falhou em cinco asserções. O helper autorizou, a API retornou sucesso, HANDOFF virou MANUAL, a sugestão foi rejeitada e surgiram três eventos. O responsável já era o ator; não houve prova de troca de owner nesse achado.
- O mesmo oráculo byte a byte ficou GREEN: sessão `29510`, terminal `3b5aa3`, EXIT0, 2/2 casos em 10,43 s.
- Regressão nativa: sessão `42600`, terminal `93843a`, EXIT0, 2 arquivos completos e 32 casos em 129,27 s. Foram executados `assumir-da-aria.int.test.ts` e `assumir-da-aria-despacho.int.test.ts`, incluindo três casos novos rastreados de papel após espera real. Não somar o oráculo de dois casos como cobertura única adicional: existe sobreposição causal.
- Lint `9dad9f`: EXIT0 nos quatro arquivos SRC, sem avisos. Não houve filtro de caso ou skip.

Os novos casos rastreados observam a sessão externa ADMIN antes da espera, mudam o papel para ALUNO, `[]` ou ALUNO+VENDEDOR e verificam DTO e API reais. ALUNO mantém todo o estado e zero eventos do atendimento; os controles ERP continuam MANUAL e rejeitam a sugestão. A contagem de eventos é filtrada pelo atendimento. Holder, action e observer são drenados em `finally`, com prazo limitado, sem usar sleep como prova de espera.

As fixtures substituem auth/cache, usando `carregarUsuarioFresco` real. API, kernel, ACL, SQL, locks, pausa, rejeição e eventos são reais. Os casos anteriores de regressão preservam o provedor simulado e o driver fake declarados para testar turno/ENVIANDO sem rede externa. Não foi executado envio real.

## Integridade e hashes

A prova `output/inbox-357-portal-sourceproof-private.json`, SHA256 `7eabfa6047e9bc6fe84f7e36edf8b7e5e9499b0f281110e144807b31a4c92e76`, verifica que reverter apenas o import e o guard recupera o helper original. O código de `acoes-atendimento.ts`, removidos os comentários, é literal ao pai. Escopo, sessão, pausa, decisões, enfileiramento, transferência e schema estão preservados.

| Evidência | SHA256 |
|---|---|
| Log RED do oráculo | `2fa1453cebd87485fa0f0f4e3fabb6529d02b884598518aa9dbc4bc654c853b8` |
| Log GREEN do oráculo | `9bf1ff85a13fecdbeb1ab1c58d419740dc9ce8a943bc7062b51bfc604c695543` |
| Log da regressão nativa | `68da4b4a16d77e9e521006479863edd248abd13bc01a5eabcaaf7b1df8a13463` |
| Observações RED | `0d3aa1e91b908485022ca3bb30b5cdd9275f2fe42d516c00c55cc90b49122979` |
| Observações GREEN | `00a422cb223f0c1a79756f92349ce4d5385a184702c2b43c3ef69a7982fea489` |

## D3 e ambiente

D3 rejeita intencionalmente todas as SUGERIDA do atendimento, inclusive CRM. O caso existente de NOTA_INTERNA permanece como controle; não foi introduzido cancelamento novo nem preservação de uma sugestão da futura #355. As intenções canceladas continuam somente IA PENDENTE/ADIADA; HUMANAS e ENVIANDO ficam preservadas. O JSDoc de fila/idempotência foi devolvido à action legada, e o da action Aria passou a descrever D3.

O DEV usou B `ci-integracao`, com 493 migrações e 425 tabelas, client `383782975cb5cd3b979559a2a48eea4ad47ce92913098387a089ca6f3e9a34ef`. É o ambiente com grant preparado pelo ROOT, sem Insights e sem grant ligado à ACL. Não atribuir esses testes ao banco 492. Configuração original, UTC, um worker, heap1024, sem paralelismo entre arquivos e sete providers vazios apenas no executor. A configuração privada do oráculo só fecha o include dos dois casos, herdando a original.

Admissão `420d9d` e liberação `6618d6` terminaram com código 0: 493/425 e zero outros atores. O banco contém fixtures; o DEV não declara o baseline504 restaurado. A lease foi liberada para ROOT restaurar com o novo restorer B493grant. Não usar o restorer492.

O WIP #370 segue preservado no stash `78d35dbb` e manifesto `17b68d64`, com o checkpoint privado `76f9`. A autorização humana específica continua pendente, sem patch de ACL. QA independente no SHA exato, gates originais da composição e aceite visual continuam pendentes. Este patch não homologa a feature inteira.
