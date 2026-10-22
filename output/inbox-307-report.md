# Handoff DEV B — #307

Branch `codex/inbox-e1-307`, base `8a320f97e4a2f4b09175a633c6a5668780e6a4f9`.

Fonte: `scripts/visual/demo-inbox.ts`, `nucleo-captura.mjs`/`.d.mts`, `capturar-inbox.mjs`, README; testes `src/test/visual-inbox.test.ts` e `visual-inbox.int.test.ts`; SPEC e quadro. Package/lock e referência PR297 foram preparados pelo integrador antes desta implementação e não são alterados pelo DEV.

## Evidência já obtida

- RED do núcleo ausente: Vitest 1 arquivo/0 testes, exit1 esperado; depois 4/4 exit0.
- RED de fonte Lucide com query: 1/4 falhou; depois 4/4 exit0.
- RED de reparo parcial real no banco dev-gravacoes: 1/1 falhou em `Demo parcial`; após upserts, integração 1 arquivo/1 teste exit0, nenhum ignorado. Confirmados sete atendimentos, nota, envio falho, origem de transferência, três tags, repetição sem duplicar, restauração de Fernanda e outro número intacto.
- RED da CLI inexistente 1/5 falhou; unitários+dependências depois 2 arquivos/9 testes exit0, nenhum ignorado, Node22.23.2.
- CLI protótipo-only: seis PNGs `conversa` em três viewports e dois temas, Chrome155 e `playwright-core`1.56.1, exit0, manifesto sem falhas. Capturas desktop escuro e celular claro inspecionadas.
- Review P1: a região da conversa podia aparecer antes de mensagens/painel; login por clique em `domcontentloaded` podia ocorrer antes da hidratação. RED determinístico do módulo de espera ausente, Vitest 1 arquivo/0 testes exit1. A CLI agora autentica via CSRF+credentials e confirma `/api/auth/session`; aguarda mensagem da fixture, nota de Beatriz e painel quando pertinente, sem delay fixo. O Drawer só recebe clique depois da mensagem renderizar. Teste com Promises diferidas prova que a espera não conclui antes de mensagem/painel/nota.
- Pós-P1: unitários+dependências 2 arquivos/12 testes exit0, nenhum ignorado; TSC Node22.23.2 com heap8192 exit0; ESLint dirigido `scripts/visual src/test/visual-inbox.test.ts --max-warnings 0` exit0. ESLint global `eslint . --max-warnings 40` na sessão 12375, exit0, 0 erros/40 avisos.
- Re-review do Drawer: RED determinístico em `celular-painel` com região Conversa oculta (1/9 falhou, exit1). A espera após o clique exige só `Painel Comercial`; a mensagem já é exigida antes do clique. Casos celular/tablet GREEN; unitários+dependências 2 arquivos/14 testes exit0, sem ignorados; TSC heap8192 exit0 e ESLint dirigido exit0. Não repetimos global após esse ajuste dirigido; integrador fará o global na fonte #306+#307 combinada.

## Pendências para congelamento

Integrador já executou a fixture duas vezes em cada perfil root/tester (saída0); aguardar servidor Next apontando para o mesmo banco, capturar doze PNGs app × protótipo, verificar manifesto e imagens. Vitest completo `--maxWorkers=2`, ESLint global na combinação #306+#307 e revisão TESTER permanecem pendentes. A fonte mono da #306 é coordenada na base integrada; não depende de acesso a Google Fonts. Nenhum envio externo.

## Rodada 4 — implementador novo, 22/10/2026

O novo DEV B assumiu HEAD 6d3c8ac2a9f740e72fe83242979303fe494cdebd e preservou o patch herdado. A arquitetura de prontidão foi revista por estado: lista exige Mariana; conversa exige mensagem específica; compositor exige também nota de Beatriz; Drawer exige mensagem antes do clique e depois Painel Comercial, aside móvel inteiramente dentro do viewport e transição do aside terminada. A região Conversa fica oculta pelo Drawer e não é exigida depois do clique. Nenhum componente produtivo foi alterado.

O patch herdado classificava aborto de GET mensagens apenas após GET idêntico 2xx e fixture confirmada. Isso foi mantido; abortos de outras rotas, 404, exceções e tráfego externo seguem falhas. O protótipo exige comando de detalhes e painel aberto. Na screenshot do app, um estilo temporário esconde somente [data-nextjs-toast]:not(:has([data-has-issues="true"])); issues, listeners de pageerror/rede e console permanecem intactos.

- Recorte herdado: 2 arquivos/15 testes, exit0 (518922), sem ignorados.
- RED do predicado real de geometria: altura zero, fora da altura e transição ainda running foram aceitos indevidamente; 3 falhas/11 filtrados, exit1 (eef618). GREEN após altura/y e getAnimations(): 2 arquivos/18 testes, exit0 (9515ab), nenhum ignorado.
- Comando GREEN: Node22.23.2 node_modules/vitest/vitest.mjs run src/test/visual-inbox.test.ts src/test/dependencias.test.ts --maxWorkers=2. É recorte, não suíte completa.
- TypeScript final: Node22 --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit, sessão31150 acompanhada até exit0 (29d061). ESLint final: Node22 node_modules/eslint/bin/eslint.js scripts/visual src/test/visual-inbox.test.ts --max-warnings 0, exit0 (d54cc0). Sem lint global novo nesta rodada.
- Primeira captura real com patch herdado: sessão74860, 34 PNGs, exit1. Única falha foi GET /inbox?c=inbox-demo-mariana-307&_rsc=... net::ERR_ABORTED no primeiro desktop escuro. Não foi reclassificada nem escondida. Manifesto e imagem inicial ficam em output/inbox-307-visual-r4-primeira/. Não houve prova suficiente para chamar esse aborto de recuperação válida. Não reapareceu na execução completa seguinte.
- Captura final: PW_CHROMIUM=Chrome local155; Node22 scripts/visual/capturar-inbox.mjs --alvo ambos --estado todos --base http://localhost:3111. Sessão60453 acompanhada até exit0 (e474e2). Manifesto: 34 PNGs, 18 app/16 protótipo, 0 falhas, 14 diagnósticos de GET mensagens recuperado. Originais preservados em output/inbox-307-visual-r4-final/, sem cookies ou credenciais.
- Inspeção real dos34PNGs via seis índices locais em output/inbox-307-inspecao-r4/: estados lista/conversa/compositor/painel corretos. Inspeção adicional individual dos quatro painéis app (celular/tablet claro/escuro): título Detalhes da conversa, Mariana, oportunidade, etapa e controles Abrir oportunidade/Editar nome/Vincular/Desvincular/Registrar opt-out; nenhum painel em branco ou ainda na conversa. Badge Next sem issues ausente na foto final. Painéis do protótipo também mostram Mariana/oportunidade/detalhes nos dois temas.
- Limite da preservação r3: foi possível preservar o manifesto32167 (19:19:18) e tablet claro antigo (19:18:08). Os dois PNGs celulares foram copiados depois de já sobrescritos pela captura74860 (19:24:00/02), portanto NÃO são evidência r3; não se reconstruiu imagem antiga. A distinção consta no README da pasta.

Ruling DEV: causa do painel vazio resolvida no harness por condição do estado final e geometria/transição, com prova em pixels. DEV entrega pronta para revisão independente do SHA congelado; aceite formal e gates globais da combinação #306+#307 continuam do integrador/TESTER. Sem install, package/lock, seed adicional, cluster, transporte externo, push ou PR pelo DEV.

## Fechamento pelo integrador — substitui as pendências históricas acima

TESTER revisou6a8ab794,18testes0/diffcheck0 e parecer favorável. Fonte combinada7e236e642b49ee96de7146a9a5766c60d2851401: captura integrador51505exit0 e independenteTESTER76466exit0, cada34PNGs(18app16protótipo)/0falhas/14diagnósticos. Integradorinspecionou todos34via6índices; TESTER estados críticos/quatrogavetas/Beatriz. Prova própria TESTER fonte306400/500+Roboto6/6exit0, sempageerrors/recursoexterno. Cópias em `output/inbox-307-combinado/` e `output/inbox-307-qa/`.

Primeiro global9542 interrompido após trava existente apontar literal de driver no teste de integração307; não foi suíte completa. RED dirigido ca23b0exit1 identifica sósrc/test/visual-inbox.int.test.ts. Ajuste76a08316995cfbac4073b69b3743852caeba97ad importaDriverWhatsApp eusaenum.BAILEYS, mesmo valor, sem relaxarguard. GREENe0419dexit0:3arquivos/19testes; integração própria rootperfilintegracao884210exit0:1arquivo/1teste após capturas e servidor parado. TESTER revisou delta favoravelmente; nenhum pixel mudou.

Global final Node22.23.2 na fonte76a08316 sessão95778 acompanhada atéexit0:846arquivos/6547testes unitários semfiltro/semignorados/maxWorkers2, TSCheap8192, lintglobal0erros40avisos herdados. Logs anexos. Commit do enum é cherry-pick no branch307; os demais diffs depois da fonte revista são documentos/evidências.

Limites explícitos do aceite: referênciaoffline usa fonte de reserva; Nextdev toast semissues ocultado somente na screenshot; abrirconversa marca leitura e contadores/listas mudam entre contextos, pois seedupdate:{} não restaura todo estado mutado. Não alegar paridadepixel de contadores. Semsuitecompleta de integração, build de produção, merge ou deploy. Entrega pronta para PR por integrador.
