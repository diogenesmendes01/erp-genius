# #298 — Classes de cor do Inbox e trava de paleta sem tom

Estado em 22/10/2026, rodada 4: correção do P2 da trava preparada e validada no recorte; **aguarda re-review TESTER do novo commit e aceite visual final**. Gates globais finais foram executados no código corrigido `815d863d`: TSC e 839 arquivos/6.466 testes exit 0; lint global exit 0 com 40 avisos após conversão ESM exclusiva do artefato de captura. Branch `codex/inbox-e0-298`, iniciada em `7e4810e5e6c4f25a00497fe743e0ea4abfb0c6ee`. Não houve alteração de banco, contrato ou permissão.

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

## Histórico da primeira validação e limites (superado parcialmente nas rodadas abaixo)

- `node_modules/.bin/tsc --noEmit` global: código 1 antes da correção ambiental, com colisão `aria/_componentes/Abas.ts` × `abas.ts` e erros numerosos de tipos Prisma ausentes em contratos/matrícula/permuta. O client Prisma copiado foi identificado como desatualizado; o integrador vai regenerá-lo. A colisão de casing terá correção transversal separada. Nenhum desses arquivos foi alterado pela #298.
- `node_modules/.bin/vitest run` global foi iniciado antes do pedido de pausa do integrador e interrompido pela mesma sessão (código 1); **não é uma execução completa**. Até a interrupção havia falhas em `design-system.test.ts` (2), `aria/page.test.ts` (12), `inbox/AcoesAtendimento.test.ts` (1) e `botoes.test.ts` (1), fora do recorte da #298. Repetir após reparo ambiental.
- Lint global ainda não executado, por pausa coordenada. Repetir TSC, suíte completa e lint com código 0 antes de declarar a entrega concluída.
- Aceite visual exigido pela issue: capturas antes/depois em 1440×900, 1024×768 e 390×844, claro/escuro, incluindo contador não lido, ✓✓, enquete, painel e devolução. O harness da E1 ainda não está integrado; capturas e comparação ficam pendentes para revisão com a tela.
- Node local v24.16.0, enquanto `.nvmrc` declara 22. Nenhuma integração de banco foi executada; não há mudança de banco nesta issue.

## Revisão TESTER do detector — 22/10/2026

O TESTER revisou o commit `53a5821fb02e3df6def85749729e49e1c86fb579` e encontrou dois casos do detector. Confirmei com o Tailwind local compilado em memória, usando conteúdo bruto isolado: `bg-origin-border`, `bg-clip-text`, `decoration-from-font` e `from-brand-500` geram CSS; `from-brand`, `via-brand` e `to-brand` não geram. O primeiro script de inspeção passou a configuração como caminho e varreu o projeto, portanto não isolava as classes; a prova válida passou o objeto de `tailwind.config.ts` com `content: [{ raw: ... }]` e conferiu os seletores CSS exatos. `docs/18-design-system.md:8` proíbe gradientes; `bg-gradient-to-r` permanece ofensor intencional da trava.

Dois testes de regressão em `paleta.test.ts` falharam antes do ajuste (2 falhas/7 testes): um acusava três utilitários com CSS, o outro deixava passar três cores sem `DEFAULT`. A classificação passou a aceitar apenas `bg-origin-border`, `bg-clip-text` e `decoration-from-font`, e a regex cobre também `from`, `via` e `to`. Recorte pós-ajuste: **6 arquivos, 45 testes, código 0, nenhum ignorado**. ESLint dirigido dos 11 arquivos TS/TSX da #298: **código 0, sem saída**. A validação global e o aceite visual continuam pendentes no commit desta correção; não foi executada nova suíte global por coordenação do integrador.

## Re-review TESTER R1 — famílias Tailwind completas

O re-review do commit `8d3c3ea2ea0438762b5bafbf4032e02505dcf27d` mostrou que outras variantes de `bg-origin-*` e `bg-clip-*` ainda eram falsos positivos. Inspecionei `tailwindcss/lib/corePlugins.js` e `tailwindcss/defaultTheme` instalados: origem tem 3 variantes, recorte 4, posições compostas 4, blend 16, divisão reversa 2 e espessura `decoration-from-font` 1. Compilei essas **30 classes** com Tailwind em memória, passando o objeto `tailwind.config.ts` e `content` bruto isolado: todas geraram seletores CSS. O teste de tabela das famílias falhou antes da correção (`bg-origin-padding` e `bg-origin-content` apareceram já na primeira linha) e passou depois. Nomes inventados `bg-origin-brand`, `bg-clip-brand`, `bg-blend-brand` e o gradiente proibido `bg-gradient-to-r` continuam ofensores.

Resultado após esta rodada: **6 arquivos, 46 testes, código 0, nenhum ignorado**; ESLint dirigido dos 11 arquivos da #298: **código 0, sem saída**. Mantive a whitelist exata dos utilitários não-cor do Tailwind instalado; cores sem `DEFAULT` continuam barradas. Re-review do novo SHA, checks globais e aceite visual continuam pendentes.

## Rodada 4 — P2 da trava de botões e consolidação

O TESTER revisou o SHA `8f26101e6d194bb1be4ddb303f71a2e8a60828fa` e apontou que `classeEmElementoSemAcao` isentava qualquer tag fora de `button`, `Link` e `a`. Confirmei no AST e por execução: os literais primários de `<Botao className="bg-danger text-white">` e `<MeuBotao className="bg-brand-solid text-on-brand">` eram ignorados, sem recuperação na segunda varredura. A rodada altera somente a trava de testes e estas evidências; nenhuma UI de produção foi alterada.

A isenção agora exige tag intrínseca `span` ou `div` e ausência de `role`, `tabIndex`, atributos de evento `on[A-Z]` e spread. O critério é conservador: papel ou atributos não verificáveis impedem provar passividade. Componentes customizados continuam sujeitos à varredura de primários, sem allowlist por arquivo/classe. Selos informativos sem esses atributos continuam ignorados pelos casos existentes. Não foram alteradas as outras verificações de variantes, cores, tamanhos ou `solid`.

### TDD e verificações executadas pelo DEV A substituto

- RED: `node_modules/.bin/vitest.cmd run src/app/botoes.test.ts -t 'o detector preserva primários|o detector não isenta'`: **exit 1**, 18 falhas por assertion (os dois componentes e 16 combinações de `span`/`div` com papel, foco, eventos ou spread), 3 casos nativos aprovados, 43 testes fora do filtro. Resultado terminal `f46948`, sem sessão pendente. A falha era lista vazia onde se esperava exatamente um primário.
- GREEN: `node_modules/.bin/vitest.cmd run src/app/botoes.test.ts`: **exit 0**, **1 arquivo, 64 testes**, sem filtro de nome ou ignorados. Resultado terminal `4b5fcb`. Inclui componentes customizados, `button`/`Link`/`a`, elementos interativos e selos passivos.
- Recorte #298: `node_modules/.bin/vitest.cmd run src/app/paleta.test.ts src/app/fundo-sobre-pagina.test.ts src/app/contraste-elementos.test.ts 'src/app/(app)/inbox/ListaAtendimentos.test.ts' src/components/conversa/BalaoMensagem.test.ts 'src/app/(app)/inbox/PainelSetor.test.ts'`: **exit 0**, **6 arquivos, 46 testes**, sem ignorados ou filtro de nome, resultado terminal `dee347`. Esse recorte não é a suíte global.
- ESLint dirigido: `node_modules/.bin/eslint.cmd` sobre os **12 arquivos TS/TSX** retornados por `git diff 3dbd3df803ef840bf2190cec9d4fc98d4a05a755 --name-only -- '*.ts' '*.tsx'`: **exit 0**, sem erros/avisos ESLint, resultado terminal `c172dd`. O Git avisou conversão LF/CRLF no arquivo editado; não é diagnóstico de lint.
- `git diff --check`: **exit 0**, resultado terminal `de2f59`; apenas avisos Git LF/CRLF, sem erros de whitespace.
- As execuções acima terminaram diretamente com código final; não houve `session_id` pendente nem processo desacoplado. O Vitest emitiu aviso preexistente sobre resolução nativa de caminhos versus `vite-tsconfig-paths`; não houve alteração de dependências/configuração.

### Gates globais já obtidos, sem apagar o histórico de falhas

Segundo o handoff do integrador (`inbox-298-r4-brief.md`), no SHA de entrada `8f26101e6d194bb1be4ddb303f71a2e8a60828fa`: TSC global com heap 8192 **exit 0**; lint global **exit 0**, zero erros e 40 avisos preexistentes; Vitest unitário completo **exit 0**, **839 arquivos, 6.445 testes**, sem ignorados. São resultados históricos executados pelo integrador antes desta correção; a execução global no código corrigido está registrada na seção final abaixo. Os erros de ambiente e a primeira execução interrompida registrados acima permanecem como histórico. Integração de banco não foi executada nesta issue visual. O integrador liberou uma janela posterior para a execução global final, registrada abaixo.

### Evidência visual preservada e limites de aceite

O parecer do TESTER em `output/inbox-298-visual.md` de seu worktree registrou 12 pares lista/conversa nos três tamanhos e dois temas, mais quatro detalhes móveis, capturados no SHA `a384afd736c7ce5838c55c1e4483a822fee3b4c6`. Badge e ✓✓ legíveis, painel lateral desktop legível, `pageerror=[]` nas seis combinações. O diff de produção entre esse SHA e o estado desta rodada é vazio; alterações posteriores são exclusivamente na trava de testes. As capturas do TESTER permanecem em seu `output/inbox-capturas/depois-298/`, e as anteriores no `output/inbox-capturas/antes/` do integrador. Esse parecer não cobre o drawer do painel em tablet/celular, enquete nem devolução de crédito no fluxo real.

Preservados em `output/inbox-298-visual/`: harness `capturar.mjs`, `metricas.json` e **24 PNGs** de antes/depois para `EnqueteLeitura` e o bloco `Reserva` de `DevolucaoCredito`, em 1440×900, 1024×768 e 390×844, claro/escuro. O harness extrai funções JSX reais por AST do baseline `3dbd3df8` e do SHA `8f26101e`, com CSS global/Tailwind/Roboto reais e fixture local, sem executar ações. As métricas mostram fundo transparente antes; enquete verde `rgb(27,135,85)` claro/`rgb(33,192,99)` escuro depois; reserva cinza `rgb(237,237,237)` claro/`rgb(42,44,44)` escuro depois.

O substituto inspecionou por amostragem `enquete-depois-escuro-390x844.png`, `enquete-antes-claro-1024x768.png`, `reserva-depois-claro-1024x768.png` e `reserva-depois-escuro-390x844.png`: progresso e bloco de reserva visíveis, sem corte dos componentes. São capturas isoladas, não homologação do fluxo financeiro ou visual de todos os estados. Após a conversão ESM do harness, foram regeneradas contra `815d863d`; os 24 PNGs permaneceram byte a byte iguais aos já inspecionados. Apenas a referência de SHA em `metricas.json` foi atualizada.

### Pendências para o integrador

Re-review independente do novo SHA pelo TESTER; aceite visual final dos estados restantes, especialmente drawer tablet/celular e uso real de enquete/devolução conforme exigência da issue; publicação do PR após os gates finais registrados abaixo. O overlay Next dev visto antes/depois segue observação preexistente no parecer TESTER, sem causa confirmada nesta rodada. Issue **não concluída**; sem push, PR, merge, deploy, mensagens reais, integração externa, alterações de package/lockfile ou início da #302. Logs locais `output/inbox-dev-a-migrations*.log` permanecem preservados fora do commit.

## Gates finais no código corrigido e ajuste exclusivo de artefato

Após autorização da janela pelo integrador, executei sobre `815d863de66982505026980faa786290211a6ae1`:

- `NODE_OPTIONS=--max-old-space-size=8192 node_modules/.bin/tsc.cmd --noEmit`: **exit 0**, sessão `59129`, conclusão `c784b5`.
- `node_modules/.bin/vitest.cmd run --reporter=json --outputFile=output/inbox-298-r4-unitarias.json`: **exit 0**, sessão `82472`, conclusão `8a8513`. Relatório JSON conferido: **839 arquivos, 6.466 testes aprovados, 0 falhas, 0 pendentes e 0 todo**, sem filtro de nome. É a suíte unitária completa configurada; `*.int.test.ts` permanece excluído pela configuração normal. O JSON fica apenas local, fora do commit.
- A primeira execução de `node_modules/.bin/eslint.cmd . --max-warnings 40` falhou com **exit 2** (`f3809c`): a inclusão do novo `.cjs` atingiu regra React sem plugin configurado para aquela extensão. Nenhum arquivo foi excluído para contornar o lint. O harness foi convertido para `capturar.mjs`, com imports ESM e `createRequire` usado exclusivamente para a função JSX transpilada CommonJS e a config TS. Sem alteração de configuração, dependências ou regra de lint.
- Repetição exata `node_modules/.bin/eslint.cmd . --max-warnings 40`: **exit 0**, sessão `29757`, conclusão `7d4298`, **0 erros e 40 avisos preexistentes**, incluindo o harness e sem filtros adicionais. Nenhum protótipo existe neste worktree.
- `node output/inbox-298-visual/capturar.mjs`: **exit 0**, `b2de78`. Validação real da conversão: métricas iguais, 24 capturas byte a byte iguais; fontes antes `3dbd3df8` e depois `815d863d`. Todo o conjunto de capturas+harness/métricas ocupa aproximadamente **336 KiB**. Não contém logs de sessão, cookies ou credenciais.
- `git diff --check` após conversão: **exit 0** (`3df8d6`). O primeiro staged check anterior havia detectado uma linha em branco extra no EOF do harness, removida antes do commit `815d863d` (staged check posterior exit 0, `d69dcf`).

O commit adicional desta consolidação altera somente o artefato de captura/métricas e a documentação; UI e código de testes permanecem exatamente os validados em `815d863d`. TSC e suíte completa não foram repetidos após essa alteração exclusiva do artefato; lint global e execução real do harness cobrem o estado ESM final. Re-review independente e aceite visual final continuam pendentes; não declarar a issue encerrada.
