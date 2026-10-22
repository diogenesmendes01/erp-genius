# Pré-requisito de validação do Inbox no Windows

Referências: épico #379 e plano do PR #297. Base: `36334f27`.

## Problema e comportamento esperado

O sistema de arquivos do Windows não distingue `Abas` de `abas`. O componente `aria/_componentes/Abas.tsx` e o módulo de dados `abas.ts` colidiam na resolução: a página `/aria` recebia um componente indefinido e o TypeScript acusava conflito de caixa. O módulo de dados passa a se chamar `abas-aria.ts`, com os dois imports atualizados. Não há alteração de navegação, acesso ou interface.

Três arquivos de teste liam CSS, TSX e YAML com CRLF e depois procuravam sequências LF literais. As leituras desses testes agora normalizam CRLF para LF; as mesmas asserções sobre estilo, confirmação e condições de publicação continuam obrigatórias. Nenhum workflow ou condição de publicação foi alterado.

## Evidências

- Reprodução de `/aria`: 12 falhas e 1 teste aprovado antes da mudança; 13/13 aprovados após o rename e atualização de imports, saída 0.
- Recorte design-system, AcoesAtendimento, página Aria e botões: 90/90 testes, saída 0.
- A primeira suíte unitária completa revelou mais três falhas em `ci-workflow.test.ts`, todas por captura vazia do job `publish` em texto CRLF: 6.434 aprovados e 3 falhas em 839 arquivos. Não foi chamada de verde.
- Recorte CI após normalizar a leitura: 16/16 testes, saída 0.
- TypeScript global: `node --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit --pretty false`, saída 0. A tentativa inicial no limite padrão de 4 GB terminou por falta de heap, saída 134; não representa aprovação.
- Lint global: saída 0, 0 erros e 40 avisos preexistentes (`--max-warnings 40`). A cópia local do protótipo do PR #297 foi excluída por `--ignore-pattern docs/planejamento/inbox-prototipo/**`, a mesma exclusão de referência prevista naquele PR.
- Suíte unitária completa final: `node node_modules/vitest/vitest.mjs run --maxWorkers=2`, saída 0, 839 arquivos e 6.437 testes aprovados, sem ignorados. Não inclui os testes de integração (`*.int.test.ts`).
- Revisão independente do commit `58eeb7b36b7718cc27e35efd635dcc66d4878144`: favorável, sem achados bloqueantes; recorte dos cinco arquivos afetados com 106/106 testes e saída 0 no worktree TESTER. O commit posterior altera somente este registro de evidências e o quadro.

Prisma Client foi regenerado pelo integrador em cada worktree a partir de seu próprio schema. Dependências foram copiadas fisicamente e conferidas contra o lockfile, sem instalar pacotes, compartilhar junction/symlink ou alterar manifesto/lockfile. Os testes de integração do Inbox usam bancos descartáveis separados; esta correção de baseline não altera banco ou servidor.
