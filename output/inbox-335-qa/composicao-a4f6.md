# QA independente — preparação #335 em a4f6

Fonte exata: `a4f6e7da34f1d04b62e5dcdf60b5027ad308684f`; base de publicação `e991c48be4aa4fd995d3f28cc1b7b4f3384b38ac` (#324/PR413). Conferência própria retomada em 24/10/2026, exclusivamente no worktree TESTER `inbox-tester/erp-genius`, com Node 22 local e dependências já existentes. Parecer favorável ao recorte unitário, à composição estática e à integração independente desta preparação. Não é homologação do ERP inteiro nem suíte global.

## Evidência nova desta retomada

- Executor `9421b7`, saída terminal 0: `node node_modules/vitest/vitest.mjs run src/lib/href-conversa.test.ts "src/app/(app)/inbox/PainelSetor.test.ts" "src/app/(app)/funil/PainelOportunidade.test.ts" "src/app/(app)/contatos/page.test.ts" "src/app/api/inbox/atendimentos/[id]/painel/route.test.ts" src/test/visual-inbox --maxWorkers=2`. Foram 19 arquivos/139 testes, 3,51s, sem filtro por nome ou skips reportados. São cinco arquivos do produto/rota/destino e 14 do harness; os dois `*.int.test.ts` do prefixo visual são excluídos pela configuração unitária e não foram contados. Comando retornou já concluído, sem `session_id` pendente. Runner local informa Vitest 4.1.11; não houve instalação/alteração de dependências.
- Executor `d24a09`, saída terminal 0: teste `src/app/(app)/inbox/abas/ContatoCabecalho.interacao.test.ts --maxWorkers=1`, um arquivo/12 testes, 504ms. O mesmo executor confirmou com diff exit0 que os três paths do fix `7ff341db2e11a92d2b42747749ddab469e862603` permanecem idênticos no a4f6.
- `acfcff` e `fbf5cc`: `git diff --check` base..a4f6 exit0 e status tracked vazio. Há muitos untracked históricos no output; foram inventariados sem limpeza, reset ou checkout. O primeiro status com sandbox default não conseguiu reconhecer o worktree; acesso escalado restrito ao worktree atribuído (`d076af`) confirmou o estado real.

## Composição e contratos

Os nove paths executáveis/testes do produto são idênticos ao `4c76d200257ea4c3df3707e95100d9180a9efdbc`. Dos 12 paths do commit original, quadro/relatório/SPEC têm evolução documental esperada; a SPEC acresce o freeze visual. Os arquivos executáveis/testes do harness são idênticos ao `6e498f867378b0489983eb11c57b664366ca408c`. O README conserva a adição #335 e a limpeza anterior de um bloco duplicado sobre telefones. Os sete arquivos finais de SPEC/relatório/parecer/JSON #335 são idênticos aos blobs do `88b84f889e1421ceca0f575971dd684113215c04` (diff exit0 `fbf5cc`). Schema, package/lock e fontes de permissões/escopos conferidas não têm delta em relação à base.

`hrefConversa` codifica o ID bruto uma vez e só monta `/inbox?c=` com `agendar=1` opcional. FINANCEIRO/SECRETARIA expõem `matriculaId` da mesma relação já selecionada e sob o mesmo gate de `matriculaCodigo`, sem query ou ACL adicional. O link usa ID codificado e texto de código público; sem ambos não cria link sem nome. `carregarCabecalho` exige os papéis das seções e consulta a matrícula dentro do escopo aplicável. Funil usa `/contatos?c=` com Pessoa codificada, e `obterContato` exige `contatos.ver` e `escopoPessoas`. Acesso de leitura D13 não se transforma em CRM global.

## Evidências preservadas, sem reatribuição

Existem `output/inbox-335-review-tester.md` (2365 B), `inbox-335-harness-review-tester.md` (1975 B), `inbox-335-final-visual-review-tester.md` (2677 B) e `inbox-335-pacote-review-tester.md` (1648 B), além de seis arquivos DEV MD/JSON finais e do pacote privado. Esses relatórios mantêm suas fontes históricas 4c76/6e498/88b; não são execução nova a4f6.

Hash SHA-256 do parecer visual preservado: `AE0E6031918E97C2D1AA6181BEF7B72D54008B31C5503C0A9B92EE0EC6091A9B`. Pacote privado de 4.321.966 B: `ED71E143255C6F540CE6E5223C1CCC7B4F416DB48A66C572F9B2B7D6EEA38A6C`. Conteúdo histórico descrito: 64 PNG/4.273.828 B, com limite móvel y482,5–499,5 e duas SSE sequenciais/máximo uma simultânea. Não houve nova inspeção de browser/captura ou download nesta retomada. Relatório QA336 preservado sem alteração: SHA-256 `550E84988094C74E070D8092B12EECE10F9FC479BFEE3845BE8B9462B7D412C4`.

## Integração própria do HEAD exato

Lease T335 liberada expressamente pelo integrador após restauro `bf350c` exit0 (424 hashes/494 linhas, snapshot preservado, sem outro executor ativo). Preflight confirmou HEAD a4f6 e perfil local `integracao`; cliente/schema487, banco descartável `erp_genius_test` em localhost54329. Executei `node node_modules/vitest/vitest.mjs run -c vitest.integration.config.ts src/server/inbox/paineis.int.test.ts src/server/inbox/paineis-envio.int.test.ts src/server/inbox/painel-detalhes.int.test.ts --maxWorkers=1`, três arquivos completos, sem -t/skips.

Sessão própria `56263`, chunk inicial `377cda`, acompanhada até chunk final `6a6c55`, saída terminal 0: **3 arquivos/32 testes aprovados**, 121,66s (118,44s nos testes), início09:37:13 em24/10/2026. Os períodos sem log não foram contados como aprovação. O globalSetup padrão fez apenas a validação read-only de status de migrações; nenhuma migração manual/aplicação de schema foi executada. O driver do motor é mockado em paineis-envio; nenhuma mensagem externa real foi enviada.

Conferência read-only consolidada `7f9760`, exit0, confirmou Nodev22.23.2, produto9/harness9/fixTags3 paths idênticos às fontes respectivas, 27paths no delta total, ausência de delta prisma/package/lock/permissoes/escopo inesperado, tracked clean e diff-check. Após a integração, HEAD/status foram conferidos novamente antes de qualquer próxima fonte.

## Limites e liberação

Esta integração é nova evidência independente do a4f6; as execuções históricas do DEV/TESTER e os gates globais/TSC/lint do ROOT permanecem separados. Não executei suíte global, TSC, lint, servidor, browser ou captura nesta retomada. Não houve instalação, Prisma manual, DDL, controle de cluster, push, PR ou merge. A recuperação/restauro do cluster foi responsabilidade do integrador. A suíte T335 terminou; banco disponível para a próxima operação coordenada. Por instrução expressa posterior, a lease exclusiva T continua para revisão C5 em outro SHA e dois arquivos INT sequenciais, que terão parecer próprio e não serão atribuídos a esta #335.
