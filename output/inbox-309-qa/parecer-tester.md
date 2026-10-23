# TESTER — revisão #309

Fonte exata `0feb3bbfff2f719c77be94b6b7e415554a99d98a`, base `f7c028f00848891d46102144e17981b8e2cbfef8`, no worktree `inbox-tester`. `git diff --check` saiu 0. Recorte independente Node 22.23.2: Avatar, BadgeEstado, estado-visual, prazo-vivo e ListaAtendimentos, **5 arquivos/69 testes, exit 0**; sem DB, servidor ou full suite repetida. O DEV reporta full 848/6591, TSC e lint globais exit0 no SHA; não atribuo esse gate ao meu recorte.

## Achado pendente

- **P2 — uppercase Unicode pode produzir três iniciais.** Em `src/components/Avatar.tsx:13-16`, as primeiras letras das palavras são concatenadas e só então convertidas por `toLocaleUpperCase("pt-BR")`. Uma letra pode expandir: `iniciais("ßeta Anna")` retorna `SSA` (3 code points; reproduzido em Node 22), violando o contrato de até duas iniciais. O avatar de 32/40 px pode receber texto maior do que o previsto. Fazer uppercase de cada letra e limitar por code point a uma letra por palavra, sem cortar pares surrogate; adicionar caso de expansão ao teste. Não altera o comportamento legado comum, mas conflita com o requisito Unicode explícito.

## Conformidade observada

Sem `tom`, Avatar mantém cor suave, tamanhos/raios legados e o fallback `#`; com tom usa classes literais dos oito tokens. Hash FNV-1a é estável pelo `contatoId`; selo IA permanece opt-in, com tamanho/borda/deslocamento de contrato. `BadgeEstado` expõe os sete tons, medidas, ponto, tracejado e ícone sem alterar consumidores. `estadoVisualItem` respeita grupo sem badges, ordem estado→setor→prazo→Sem nome→fila, fronteira estrita do prazo e 29→30 min, prévia nula vazia e selo IA desligado. `estadoVisualCabecalho` resolve responsável/grupo/encerrado e subtítulo. O #309 entrega produtores; os consumidores novos e a comparação visual em três viewports/dois temas são da Task7, conforme SPEC, sem homologação presumida aqui.

## Re-review R1 — `879ea530f21014178ce700b71efe5c5dcd8bf139`

O P2 foi corrigido de forma dirigida. `iniciais` agora capitaliza cada letra selecionada separadamente e conserva o primeiro **ponto Unicode** de cada resultado. Assim `ßeta Anna` vira `SA`, ligatura `ﬃona Anna` vira `FA` e as letras fora do BMP preservam os pares surrogate. Os sete casos novos cobrem expansão no início/fim e duas letras fora do BMP; cores, hash, tamanhos, selo e consumidores não mudaram. `git diff --check 0feb3bbf 879ea530` saiu 0. Recorte independente Node 22.23.2: os mesmos cinco arquivos, **76 testes, exit 0**, sem DB nem full suite repetida.

**Parecer final #309 favorável no SHA R1.** O achado Unicode foi encerrado. O aceite visual dos novos consumidores permanece vinculado à Task7, como estipulado pela SPEC; não há tela própria nesta issue.

## Re-review R2 — `bcda5a04bb849579dea79ef46a2ffb333b6ab6f3`

A full integrada do integrador apontou que a forma R1 com `selecionadas.map` excedia a profundidade da trava AST de identificação. O delta R2 altera só `src/components/Avatar.tsx` e evidências: uppercase e primeiro ponto Unicode passam a ocorrer no `flatMap` original; a seleção da primeira/última inicial mantém a forma simples. O comportamento de `ß`, ligatura e letras fora do BMP continua coberto pelos testes R1, sem cortar surrogate e sem mudar hash, cores, tamanhos ou selo. Nenhuma guarda, whitelist ou limite AST foi alterado. `git diff --check 879ea530 bcda5a04` saiu 0. Meu recorte Node 22.23.2 com Avatar, `identificacao-registro`, BadgeEstado e estado visual: **4 arquivos/83 testes, exit 0**, sem banco nem full repetida.

**Parecer final de código #309 favorável no SHA R2**; os gates globais da combinação continuam sob acompanhamento do integrador. Aceite visual dos consumidores segue na Task7.
