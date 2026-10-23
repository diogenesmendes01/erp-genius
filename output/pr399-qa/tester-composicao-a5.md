# QA independente de composição — PR #399

Fonte exata: `a5ecee157f5fb274013e9c82d3d6229bce448b2e`, merge dos pais `c962c250cbc3a78d6ad9d89a8ac2227511759905` (limpeza #399) e `332f3cb1a96fad4972b3e651135332f72cefa77e` (base composta #400). Parecer estático favorável à composição; integração final, CI e publicação continuam gates separados.

## Verificação própria

- `git rev-parse HEAD` confirmou o SHA e os rastreados estavam limpos. Comparei objetos Git e `git diff --quiet`: `ConversaAberta.tsx` e seu teste, `PainelContato`, `LinhaCampo`, `PainelSetor` e respectivos testes, `src/server/inbox` pertinente, `prisma/schema.prisma` e migrações permanecem iguais ao pai `c962` (exit 0). A diferença em `prisma` contra esse pai é só `seed-qa.ts`, incorporado da outra linha, não DDL.
- `BalaoMensagem`, `itens-thread`, `preferencias.ts`, `package.json`, `package-lock.json`, testes de dependências e respectivos contratos são iguais ao pai `332f` (exit 0). Planos #297, E2E, `.github` e teste/contrato de dependências também são iguais a `332f` (exit 0); não há alargamento de permissões ou lockfile produzido pela resolução.
- Na composição frente a `c962`, `InboxNovo.tsx` e `ListaAtendimentos.tsx` mudam só comentários sobre `agoraInicial`; `prazo-vivo.ts` ganha só comentários de compatibilidade e relógio. `git diff --check c962 HEAD -- src` terminou 0. Os módulos de estados futuros #319 não foram introduzidos nesse recorte.
- A limpeza órfã permanece: `ConversaAberta` não recebe `triagem`/`revisoes`; o teste real de `InboxNovo.interacao` confirma ausência dessas props. `InboxNovo` ainda recebe e renderiza `PainelTriagem` tanto na seção sem seleção quanto no painel aplicável, com os casos de composição, troca de contato e grupo no teste existente. A triagem não foi removida do produto.

## Limites

Não rodei suíte, banco, browser, Prisma ou CI neste merge. O recorte 9 arquivos/187 casos, TSC, lint e integração citados pelo outro integrador são evidência externa, não meus resultados. O `git diff --check` amplo entre os pais acusa CRLF como whitespace no HTML de QA herdado da linha `332f`; o recorte de `src` passa e nenhum HTML foi alterado pela resolução funcional. A prova final de integração/CI e a inspeção documental do head publicado seguem com o integrador. Não encontrei bloqueio alto ou médio novo na composição. A futura decisão D13 da #409 não foi usada como requisito desta QA.
