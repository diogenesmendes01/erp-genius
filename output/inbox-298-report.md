# #298 — Classes de cor do Inbox e trava de paleta sem tom

Estado em 22/10/2026: implementação e testes dirigidos preparados; **validação global e aceite visual pendentes**. Branch `codex/inbox-e0-298`, iniciada em `7e4810e5e6c4f25a00497fe743e0ea4abfb0c6ee`. Não houve alteração de banco, contrato ou permissão.

## SPEC de comportamento

- O contador de mensagens não lidas da lista usa fundo de marca sólido com texto `on-brand`; o indicador ✓✓ de leitura usa o tom de texto da marca. O progresso da enquete usa o fundo sólido da marca.
- Rótulos e vazios do painel lateral usam texto secundário legível nos dois temas. A reserva de devolução de crédito usa fundo neutro perceptível sobre a página.
- Um literal TS/TSX de UI não pode usar utilitário de cor sem tom que não exista no mapa `tailwind.config.ts`. Tokens escalares, chaves não numéricas do mapa e utilitários que não são cores permanecem válidos. Comentários são ignorados pelo parser TypeScript; CSS fica fora da regra nova.
- O detector de cores com tom, sombras, cores arbitrárias e a trava de fundo sutil continuam ativos.

## Implementação e TDD

Os sete usos sem CSS que o detector encontrou no código-base eram: `ListaAtendimentos` (`bg-brand`), `BalaoMensagem` (`text-brand`), `EnqueteLeitura` (`bg-brand`), três usos de `text-muted-foreground` em `PainelSetor` e `bg-muted` em `DevolucaoCredito`. Foram trocados por `bg-brand-solid`, `text-brand-700`, `text-gray-600` e `bg-gray-100`, respectivamente. `literaisDeString` foi extraído do teste de fundo para `src/test/literais-string.ts`; a nova varredura vive em `src/app/paleta.test.ts`.

- RED: `ListaAtendimentos.test.ts` falhou no contador; `BalaoMensagem.test.ts` falhou em ✓✓; `PainelSetor.test.ts` falhou no rótulo. O detector novo falhou em `bg-brand`. Após implementar o detector, a varredura falhou com **exatamente os sete usos acima**. Todos os comandos RED terminaram com código 1 por assertion. Uma primeira tentativa de Vitest sem escalonamento terminou antes dos testes por EPERM no cache do sandbox; foi repetida fora do sandbox.
- GREEN dirigido: `node_modules/.bin/vitest run src/app/paleta.test.ts src/app/fundo-sobre-pagina.test.ts src/app/contraste-elementos.test.ts src/app/(app)/inbox/ListaAtendimentos.test.ts src/components/conversa/BalaoMensagem.test.ts src/app/(app)/inbox/PainelSetor.test.ts`: código 0, 6 arquivos, 43 testes. Nenhum teste ignorado nesse recorte. O aviso preexistente de `useLayoutEffect` no SSR de `VirtualList` apareceu no RED; a saída GREEN resumida não o mostrou.
- `git diff --check`: código 0.

## Verificação pendente e limites

- `node_modules/.bin/tsc --noEmit` global: código 1 antes da correção ambiental, com colisão `aria/_componentes/Abas.ts` × `abas.ts` e erros numerosos de tipos Prisma ausentes em contratos/matrícula/permuta. O client Prisma copiado foi identificado como desatualizado; o integrador vai regenerá-lo. A colisão de casing terá correção transversal separada. Nenhum desses arquivos foi alterado pela #298.
- `node_modules/.bin/vitest run` global foi iniciado antes do pedido de pausa do integrador e interrompido pela mesma sessão (código 1); **não é uma execução completa**. Até a interrupção havia falhas em `design-system.test.ts` (2), `aria/page.test.ts` (12), `inbox/AcoesAtendimento.test.ts` (1) e `botoes.test.ts` (1), fora do recorte da #298. Repetir após reparo ambiental.
- Lint global ainda não executado, por pausa coordenada. Repetir TSC, suíte completa e lint com código 0 antes de declarar a entrega concluída.
- Aceite visual exigido pela issue: capturas antes/depois em 1440×900, 1024×768 e 390×844, claro/escuro, incluindo contador não lido, ✓✓, enquete, painel e devolução. O harness da E1 ainda não está integrado; capturas e comparação ficam pendentes para revisão com a tela.
- Node local v24.16.0, enquanto `.nvmrc` declara 22. Nenhuma integração de banco foi executada; não há mudança de banco nesta issue.
