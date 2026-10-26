# #357 — hardening portal após espera

A correção adiciona somente o import de `apenasPortal` e um retorno null no começo de `contextoAssumirAria`. O helper compartilhado recebe a row fresca da TX, cobrindo DTO e mutação. Não muda papéis, sessão memoizada, locks MAX3, cancelamentos ou idempotência. Em `acoes-atendimento.ts`, apenas os JSDocs foram corrigidos. D3 continua rejeitando todas as SUGERIDA do atendimento, inclusive CRM.

QA detalhada e hashes: `docs/qa/inbox-357-portal-apos-espera.md`.

- UNIT RED `27d736`, EXIT1: 1 falha/9 controles verdes. GREEN `728dbe`, EXIT0: 2 arquivos/10 casos.
- Oráculo TESTER copiado byte a byte, SHA `8196db7b...`: RED `30130/612418`, EXIT1, 1 ERP passou/1 portal falhou; GREEN `29510/3b5aa3`, EXIT0, 2/2.
- Regressão `42600/93843a`, EXIT0: dois arquivos completos/32 casos, incluindo três novos controles rastreados após espera real. Não somar os dois casos do oráculo como cobertura única: há sobreposição.
- Lint `9dad9f`, EXIT0: quatro arquivos SRC, zero avisos. Sem filtros ou skips.

A sourceproof `7eabfa60...` demonstra o delta mínimo do guard e código literal da API legada, descontados os comentários. Os controles preservam `[]` e ALUNO+VENDEDOR. Casos rastreados observam outerADMIN, bloqueio real, papel fresco e DTO/API, drenando holders e action; eventos são filtrados pelo atendimento. Auth/cache são fixtures com usuário fresco real. SQL, ACL e mutações permanecem nativos; os drivers/provedores simulados anteriores não enviam rede externa.

O B usa o perfil ci-integracao493grant, 425 tabelas e client383, preparado pelo ROOT; não é evidência de banco492 nem de grant ativado na ACL. Sete providers vazios só no executor, configuração original, UTC, um worker/heap1024/sem paralelismo. Admissão420d9d0 e liberação6618d60, zero outros atores. Banco com fixtures liberado para restauração ROOT, não presumido504. Nenhuma lease SQL nova.

O pai `360858dc` contém #334 e o checkpoint privado `76f9` com dois arquivos de schema. Integrar somente o delta deste commit #357, sem publicar os pais privados nem copiar a árvore B. O WIP #370 permanece no stash78d35dbb/manifest17b68d64; a pergunta humana específica continua pendente, sem autorização presumida ou patch de ACL.

QA exata, gates de composição e visual permanecem pendentes. Não houve install, mudança de config/package/lock/envfile, DDL, generate, build, servidor, browser, push ou envio externo pelo DEV.
