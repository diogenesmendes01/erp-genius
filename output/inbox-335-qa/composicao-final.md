# QA independente — composição final #335 em e0

Fonte exata `e0b35f2c54d90ad79cfc70ef69d20b688290de29`, sobre main `6fe0e49ad5cd6c6dc5e929494d62b33a7770cc26`. Parecer favorável à composição estática e ao recorte unitário novo. Revisão no worktree TESTER exclusivo em 24/10/2026, sem banco ou browser.

Preflight/checkout `e5d593`, exit 0: tracked limpo e pareceres privados anteriores preservados. Verificação estrita `aba719`, exit 0:

- Tree do E0 e do pré-rebase `bf3443f4a922d2290ec18d372a4d2edf3ae69fb1` é o mesmo `24187200c15d98ba45c420143effeb0cd256710a`; main6fe é ancestral. O rebase não alterou conteúdo.
- Nove paths executáveis/testes do produto #335 idênticos a4c76, nove do harness idênticos a6e498, três do fix Tags idênticos a7ff341d, três do C5 idênticos a0e4ec6e.
- Todo o delta src/scripts contra a4f6 é exatamente ContatoSemNome.tsx (comentário CAS), crm/tags.ts (orientação inativa) e acoes-painel-tags.int.test.ts (assert reforçado). Schema/package/lock idênticos a4f6. Diff-check exit0 e tracked limpo.

O handoff concatenou um d ao SHA pré-rebase. A primeira checagem19cd01 saiu1 antes das comparações por identificador41hex inválido. A resolução Git `a4be53` confirmou o SHA40hex bf3443f4a922d2290ec18d372a4d2edf3ae69fb1; a checagem estrita foi então executada integralmente em aba719. Nenhuma fonte foi modificada.

UNIT novo no E0: `node node_modules/vitest/vitest.mjs run src/lib/href-conversa.test.ts "src/app/(app)/inbox/PainelSetor.test.ts" "src/app/(app)/funil/PainelOportunidade.test.ts" "src/app/(app)/contatos/page.test.ts" "src/app/api/inbox/atendimentos/[id]/painel/route.test.ts" src/test/visual-inbox --maxWorkers=2`. Executor `f1dbe4`, saída terminal0, **19 arquivos/139 testes, 3,22s**, sem -t/skips; os dois *.int do prefixo visual são excluídos pela config unitária. Comando já retornou concluído, sem session_id pendente. Node22.23.2/dependências locais, sem instalação. Recorte, não global.

Não repeti INT: a execução própria a4f6 permanece nominal à sessão56263/6a6c55, três arquivos completos/32 testes/121,66s/exit0. A identidade forte acima sustenta sua aplicação estática à composição, sem alegar execução no E0. O C5 também tem execução própria separada em0e4, sessão46676/ba3aed, dois completos/25 testes/96,11s/exit0. Os pareceres anteriores guardam detalhes e limites.

Global ROOT1276/d02cc7 (916/7205), TSC1218/621415 e lint final38745/80d965 (40 baseline) são evidências comunicadas pelo integrador para a mesma árvore pré-rebase; não foram reexecutados pelo TESTER. A tentativa anterior de lint43 avisos incluía três helpers privados e não é atribuída ao código publicado. CI/merge PR413 também são gates do integrador. Publicação/CI da própria #335 continuam separados.

Sem edição de app/schema/permissões, limpeza, Prisma/DDL, integração nova, preview, browser, envio externo, push, PR ou merge. Eventual próximo commit apenas documental deve preservar a identidade da fonte revisada.
