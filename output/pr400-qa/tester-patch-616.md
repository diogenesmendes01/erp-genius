# QA independente — PR #400, contrato de leitura e rótulos

Fonte exata: `616496ac4ac126462348a7d804641f17e593bebb`, pai `3b852c548337f56ae284c747ad403c85a9f3fdf4`. Parecer favorável ao delta documental/estático, sem achado alto ou médio. Checkout detached e rastreados limpos.

## Inspeção e prova própria

- Delta de quatro arquivos (`b373df`): em produção, somente o JSDoc de `marcarAtendimentoLido` mudou. Corpo, assinatura, imports e chamada a `registrarLeituraAtendimento(atendimentoId, true)` permanecem intactos. O alias manual continua invalidando `/inbox` pelo caminho atual; o caminho automático chama a mesma operação com `false`. O novo Inbox importa exclusivamente `marcarAtendimentoLidoAutomatico` (`c3069c`, `f3b5ef`). Não se criou parâmetro do cliente nem se alterou a política de Server Action.
- Comparei de modo independente `src/server/whatsapp/preferencias.ts` do pai e do head com `TypeScript.transpileModule` (ES2022/ESNext, `removeComments:true`): **JS byte idêntico**, 4.573 bytes, SHA-256 `1c84aacf6c3b95b466a9257a6fdb023c8a010be96442dec7d804e1befcc95e9d`, execução `71e126` exit 0.
- A SPEC condiz com o JSX/testes existentes: `ColunaConversas` contém o h1 visível “Conversas”, sem h1 em `page.tsx`; `SeletorNumero` conta somente saúde `conectado` e usa singular para 1, plural para 0/2. Isso documenta os rótulos atuais, sem mudança produtiva ou novo consumidor do alias legado (`f3b5ef`).
- C4: nenhum artefato histórico foi removido ou modificado pelo patch. `git diff --check` no código/SPEC/relatório retornou 0 (`f3b5ef`).

## Limites

Não rodei testes de comportamento, banco, browser, Prisma, instalação, typecheck, lint ou global neste SHA: o delta executável é vazio, e um teste que apenas espelha o JSDoc não acrescentaria prova. Os recortes 8/139 UTC/SP, TSC e lint do DEV são evidências dele, não minhas. C1/C6, main/retarget/CI e a integração nominal C2 continuam com o integrador; este parecer não declara a PR pronta para merge.
