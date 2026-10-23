# QA independente — PR #409, contrato D13

Fonte exata: `dc726812e39d4defc24ff5f3d31455f8e6dd4952` (pai `58b2d4b8574772dc70232cbe05188041c03cfe99`). Parecer favorável ao patch de contrato e à integração dirigida própria; composição/CI final continuam separados.

## Revisão estática

- Delta de cinco arquivos: quatro Markdown e somente `src/server/inbox/painel-detalhes.int.test.ts` em `src`. `git diff --quiet` confirmou runtime de painéis, schema/migrações, scripts, package/lock idênticos ao pai (exit 0); `git diff --check -- src` terminou 0. Blob do teste novo `30f7ec7bfcea7eb0ec2020c84d43aa6a68b9f951`.
- A decisão humana D13 registrada na SPEC permite Pessoa, empresa contextual e participantes B2B a todo convidado **autorizado e vigente no atendimento COMERCIAL**, mesmo sem `contatos.ver`; não concede ficha CRM global, campos personalizados, catálogo/edição de tags, envio ou outros setores. Conferi essa distinção na SPEC e nos asserts.
- O `it.each` expande FINANCEIRO, PROFESSOR e GERENTE_PEDAGOGICO, todos sem `contatos.ver`. Cada fixture cria Pessoa/empresa/participantes B2B preenchidos, campo personalizado e tag existentes; o dono enxerga estes últimos, evitando negativos vacuosos. O convidado vê o DTO contextual completo somente após convite, não vê campos/tag, perde acesso quando o convite é revogado ou expirado, e permanece sem Pessoa/oportunidade/B2B em PEDAGOGICO/SECRETARIA/FINANCEIRO mesmo com convite. A Pessoa principal é distinta do interlocutor efetivo. Não achei ampliação da matriz global ou relaxamento de autorização de servidor no delta.

## Execução própria

Node 22.23.2 local, `vitest.integration.config.ts`, perfil `.erp-test-profile=tester`, banco descartável 487 preparado pelo integrador, `--maxWorkers=1 --no-file-parallelism`, provedores externos vazios. Arquivos completos `src/server/inbox/painel-detalhes.int.test.ts` e `src/server/inbox/paineis.int.test.ts`, sem filtro de nome ou skips observados. Sessão executor **1167**, chunk inicial `3005c9`, chunk terminal `c55d5b`: **2 arquivos, 28 testes passaram, exit 0**, duração 84,49 s. Warning prévio MIXED_EXPORTS de Vite não causou falha nem alteração de configuração. Banco liberado ao integrador imediatamente após saída terminal; restauração cabe a ele.

## Limites

Não rodei unitários, TSC, lint, browser, Prisma, migração ou suíte global neste SHA; os gates DEV 102 unitários/TSC/lint e integração A28 são de outra execução. Este patch só fixa prova de comportamento já existente, logo não há RED de runtime. A integração/CI e o retarget após composição com outras PRs ainda precisam ser observados no head final; não homologo a pilha por extrapolação desta fonte. O relatório privado #323 que colidia no checkout foi preservado sem alteração em `output/qa-private-history/checkout-409/inbox-323-review-tester.md`, SHA256 `B669D3EDAAD91AAD0F7728F08B35CB67C569E4943BA7A1436ECB865A34382528`.
