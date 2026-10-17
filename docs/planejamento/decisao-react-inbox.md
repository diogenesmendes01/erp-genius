# Decisão Q6: versão do React para o Inbox novo

Decisão: manter 18.3 na Fase 3. Status: decidido pelo dono em 17/10/2026.

## Contexto

`package.json` declara `react` e `react-dom` em `^18.3.1`. A Fase 3 porta os componentes de conversa do motor para `src/components/conversa/`.

## Conferências

- Nenhum `use(`, `useActionState`, `useOptimistic` ou `useFormStatus` em `src/` na linha de base (main 08e2b4b7).
- O App Router do Next 16.3.5 roda com o React empacotado no próprio Next (`node_modules/next/dist/compiled/react`, versão 19.3.0-canary). O `react` de `package.json` (18.3.1) vale para os testes (`renderToStaticMarkup`) e para os tipos. A troca de versão afeta sobretudo tipos e testes.

## Regra

O código de `src/components/conversa/` não usa API exclusiva do React 19 enquanto `package.json` estiver em 18.x. A trava é `src/components/conversa/react-compat.test.ts`.

## Se o dono decidir pelo 19

O integrador sobe `react`, `react-dom` e `@types/react*` (alteração de `package.json`, que não é de agentes) antes de qualquer tarefa que use a API nova. Com `react` fora de 18.x, o primeiro teste deixa de restringir; a decisão acima deve ser trocada por "atualizar para 19".

## Status

Status: decidido pelo dono em 17/10/2026. A Fase 3 fica no React 18.3. A migração para o React 19 vira um PR separado,
depois das Fases 3 e 4. Até esse PR, vale a regra acima (sem API exclusiva do 19). Antes, o ruling do integrador era
ficar no 18.3 nesta fase, por ser o menor risco. Registro: [decisoes-dono-2026-10-17.md](decisoes-dono-2026-10-17.md).
