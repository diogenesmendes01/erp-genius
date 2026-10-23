# QA independente — extensão #397 sobre main/QA #280

Fonte exata: `6436482954cf6e3cb2d2aa4b8c69aaddf375efb6`, pais `194fd6b9f9f7d8993f794d82b14dfa7566eb7966` (fonte funcional já revisada) e `2f512985d182cd8c3d074bb3963ddbfa7da9fc98` (main). Parecer favorável à extensão estática, sem achado alto/médio. Checkout detached e rastreados limpos.

## Identidade e contratos

- `git show 003025b1 --name-only` enumera 43 caminhos do kit QA #280: 40 adições e três arquivos modificados. Comparei, um a um, seus OIDs em main `2f512985` e neste merge: **43/43 idênticos**, zero divergências (execução `6ec707`). Inclui documentação, PDFs, modelos, e2e/config, seed-qa, gitignore e scripts em `package.json`. Os novos arquivos de QA não foram executados neste parecer.
- Entre a fonte `194fd6b9` e este head, `scripts` é byte idêntico e `src` difere somente nos comentários de `InboxNovo.tsx`, `ListaAtendimentos.tsx` e `prazo-vivo.ts` (`f899d9`). `ItemConversa.tsx` tem o mesmo OID `041e2833...` nos dois commits. Nenhum algoritmo, JSX, hook ou backend mudou neste delta.
- Comparei o JS emitido por `typescript.transpileModule` com `removeComments:true` nos três arquivos: os três outputs e respectivos SHA-256 são iguais à fonte `194fd6b9` (`0cf2e3`, exit 0). Essa comparação não substitui typecheck global.
- A SPEC C2 condiz com `criarRelogioDosPrazos`: uma assinatura mantém um timer pendente, agenda a próxima fronteira visual relativa aos itens e limpa a espera no unsubscribe; não há polling de rede. Portanto, prazo individual desalinhado pode despertar mais de uma vez por minuto.
- C3 condiz com `page.tsx`: `Date.now()` é capturado uma vez e passado a `InboxNovo`, que repassa a `ListaAtendimentos`; o snapshot inválido/ausente do hook é `0` até hidratar. A opcionalidade das props permanece por compatibilidade com consumidores diretos.
- C4 identifica `proximoEstouroEm` e `esperaAteProximo` como exports legados. A busca em `src/scripts` não revelou consumidor produtivo; `proximaMudancaVisualEm` continua no relógio atual. A depreciação não remove API nem adiciona atraso `+1 ms` à implementação vigente.
- `git diff --check` no escopo alterado da #397 (`src`, SPEC e relatórios) retornou 0 (`f899d9`). O diff geral contra `194fd6b9` inclui HTML/PDF QA #280 com CRLF herdado da main, portanto não o uso como gate de whitespace desta revisão.

## Limites

Não rodei testes, banco, browser, Prisma, instalação ou nova suíte global neste SHA; os 10 arquivos/120 testes próprios do parecer `194fd6b9` pertencem àquela fonte, não a `64364829`. TSC/lint reportados pelo outro integrador não são minhas execuções. CI final em dois fusos, retarget e merge seguem com o integrador. Este parecer estende somente a identidade executável e a coerência documental da composição.
