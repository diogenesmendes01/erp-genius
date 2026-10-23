# QA independente — composição moderna #403

Fonte exata: `741f595e1f9f32cd3511cbba6808bcd005e1c9c8` (base informada `a8dba58c443ff24be4745e51aab47abed9c4cf2a`). Parecer favorável ao recorte estático; nenhum achado bloqueante nesta composição.

## Identidade e delta

- Entre a fonte C3 já revisada `f896c306d474f76038c3b6c4425c4b0a214a4b6c` e `741f595e`, o delta em `src/` contém somente seis arquivos: `estado-visual.ts`, novo `estado-visual.servidor.test.ts`, novo `prazo-atendimento.ts`, `prazo-vivo.ts`, `Avatar.tsx` e `Avatar.test.ts`. `scripts/`, `prisma/`, `package.json` e `package-lock.json` não têm delta nessa comparação (`git diff --name-status ... -- src scripts prisma package.json package-lock.json`, sessão `0b1896`, saída 0).
- Objetos Git idênticos em `f896` e `741f`: `Compositor.tsx` (`19c3c526`), `rascunhos-conversa.ts` (`3c710809`), teste React real de rascunho (`de60a6ca`), `AcoesAtendimento.tsx` (`8c04bb14`), `ConversaAberta.tsx` (`e28c2968`) e `RodapeConversa.tsx` (`cdf43252`). Conferência sessão `ef161a`, saída 0. Testes e componentes de menu/C3 não ganharam lógica nova aqui.
- `prazoEstourado` foi extraída literalmente do módulo cliente `prazo-vivo.ts` para `prazo-atendimento.ts`, que só importa `ItemListaInbox` com `import type`. `estado-visual.ts` agora a importa do módulo puro, enquanto `prazo-vivo.ts` a reexporta; assinatura e predicado de grupo, encerrado e limite estrito de tempo permanecem iguais. O relógio e a assinatura do hook cliente não mudaram. O novo teste de servidor falha se `estado-visual` alcançar `prazo-vivo`, protegendo a fronteira.
- Em `Avatar`, somente o selo `ia` recebe `role="img"` e nome acessível `Aria atendendo`. Avatares comuns continuam `aria-hidden`; cálculo de iniciais, tom e cor não mudou. Não encontrei ampliação de permissão, transporte, estado de leitura ou contrato de ação nos seis arquivos.

## Execução própria

- Node 22 local, Vitest dirigido: `estado-visual.test.ts`, `estado-visual.servidor.test.ts`, `prazo-vivo.test.ts`, `prazo-vivo.interacao.test.ts`, `Avatar.test.ts` e `Compositor.rascunho.interacao.test.ts`, `--maxWorkers=2`. Sessão `63aaeb`: **6 arquivos / 85 testes passaram, exit 0**. Nenhum filtro de casos ou skip foi informado pelo Vitest.
- `git diff --check f896..741f`: sessão `6045be`, exit 0. `git rev-parse HEAD`: sessão `9063ff`, SHA exato acima.

## Limite

Esta extensão não executou suíte global, TypeScript, integração com banco nem browser ERP. Os gates globais pertencem às frentes coordenadas. As seis capturas positivas de menu do SHA A7/29f comprovam somente o menu anterior; não são prova nova do C3 em `741f`. A aprovação do C3 permanece baseada na revisão independente de `f896` e na identidade dos objetos acima.
