# Re-review TESTER R4 — #298

SHA exato `815d863de66982505026980faa786290211a6ae1`, base do ajuste `8f26101e6d194bb1be4ddb303f71a2e8a60828fa`. Checkout exclusivo `inbox-tester`.

## Parecer de código

**P2 da trava de botões resolvido; sem novo achado bloqueante no diff R4.** `classeEmElementoSemAcao` em `src/app/botoes.test.ts:211-222` isenta somente `className` de `span`/`div` sem `role`, `tabIndex`, atributo de evento `on[A-Z]` ou spread. Portanto, o contador de não lidas continua sendo selo passivo, enquanto `<Botao>`, `<MeuBotao>`, `button`, `Link` e `a` com primário literal voltam a ser acusados. Os testes novos exercitam cinco exemplos de ações e dezesseis combinações de `span`/`div` interativos ou não verificáveis. O detector original de botão nativo e Link e as travas de variantes/tamanhos não foram alterados. A correção está limitada a teste e evidência; o diff de produção desde as capturas `a384afd7` segue vazio.

Recorte independente no SHA: `vitest run` em `botoes.test.ts` e os seis arquivos dirigidos #298: **7 arquivos, 110 testes, exit 0**, nenhum ignorado na saída (**64** da trava, **46** do recorte de cores/componentes). Não repeti suíte global, TSC ou lint global; o integrador registrou exit 0 no SHA anterior `8f26101e` e coordena eventual repetição final.

## Evidência e documentação incluídas

`output/inbox-298-report.md` e `docs/planejamento/quadro-entregas.md` distinguem corretamente RED, GREEN dirigido, gates globais do SHA de entrada e aceite visual ainda pendente. O novo diretório `output/inbox-298-visual/` contém harness `capturar.cjs`, `metricas.json` e exatamente **24 PNGs**, total **335.971 bytes**. O harness usa funções JSX reais das versões antes/depois, CSS/Tailwind/Roboto locais, fixture fictícia e não executa ações do sistema. Busca por termos comuns de segredo nos arquivos de suporte não retornou ocorrência; imagens amostradas mostram somente os componentes e valores fictícios.

Inspecionei amostras de enquete e reserva antes/depois em claro/escuro e tamanhos diferentes: o progresso da enquete aparece verde depois e a reserva ganha fundo neutro visível. `metricas.json` registra fundo transparente antes, enquete verde `rgb(27,135,85)` claro/`rgb(33,192,99)` escuro depois e reserva cinza `rgb(237,237,237)` claro/`rgb(42,44,44)` escuro depois. São **capturas isoladas de componente**; não verificam a ação real de devolução nem o fluxo financeiro. As capturas da aplicação para badge/✓✓ no SHA `a384afd7` permanecem válidas porque este SHA não altera produção.

## Pendências fora deste parecer

Aceite visual do drawer do painel em tablet/celular e dos estados de enquete/devolução no fluxo real, se exigido para homologação integral; gates globais finais no SHA escolhido pelo integrador; publicação/integração do PR. A revisão de código R4 é favorável, mas não marca a issue homologada.
