# #309 — ledger DEV B

Plano aprovado: docs/superpowers/plans/2026-10-22-inbox-prototipo-02-design.md, Task4. Contrato: índice00. Base7e236e642b49ee96de7146a9a5766c60d2851401; branchcodex/inbox-e1-309; worktreeinbox-dev-b. Execução inline; revisão final pelo TESTER existente.

- Baseline dirigida Avatar/paleta/fundo/contatos:7arquivos45testes, exit0(bc3aae), semignorados.
- Pre-flight: Avatar consome tokens306 presentes; estado visual consome prazoEstourado302 e ItemListaInbox; futuros consumidores são Tasks7/10/13. Não mudar consumidores nesta task.
- Ruling: ledger neste output do worktree atribuído; plano é lido no root, sem escrever workspace SDD fora da atribuição.
- Ruling: Task4 Step5 diz semtela própria, aceite visual naTask7; não forçar integração em consumidores para simular conclusão. Gates/evidências serão reportados sem homologação presumida.

- RED inicial:10falhasAvatar/4passaram e2suítes por módulos novos ausentes, exit1(e0f74c). Um script de edição teve erro sintático de escape antes de escrever arquivos(ebff2d); corrigido sem alterar fonte parcialmente.
- GREEN3arquivos47testes exit0(c8300e), semignorados. Recorte ampliado11arquivos111testes exit0(a444ec), semignorados: Avatar/Badge/estado/paleta/fundo/contatos/prazo/listaatual.
- TSC heap8192 sessão92032 exit0(4f1a35). Lint dirigido acusou react/no-children-prop nohelperBadge; corrigido apenas helper, lint e Badge10/10 exit0(f7775d).
- Fullunit43466 e lintglobal20014 iniciados antes da notícia da dependência30776a08316. Integrador pediu cherry-pick dessa correção de teste legada antes de novo full; execução em curso será observada até saída para não mudar fonte durante gate.

- Execução43466 interrompida por CtrlC a pedido do integrador após guarda307 acusar fixture legada; retorno1 observado(f51c6d), suíte INCOMPLETA, não é falha de execução completa. Log preservado em output/inbox-309-vitest-interrompido.log.
- Lint global20014 terminou exit0(1437b8),0erros40avisos herdados.
- Dependência30776a08316995cfbac4073b69b3743852caeba97ad incorporada por cherry-pick autorizado como f7c028f00848891d46102144e17981b8e2cbfef8; muda somente import/enum no teste307. Guarda sem-provedores-legados dirigida1/1 exit0(291705), semignorados. PR309 terá basefinalcom essa dependência, não a atribuir ao escopo309.

## Evidências finais da fonte309

- TSC final: Node22.23.2 --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit, sessão59086 acompanhada até exit0(74876e).
- Full unitário: Node22.23.2 node_modules/vitest/vitest.mjs run --maxWorkers=2, sessão77497 acompanhada até exit0(6366da). **848 arquivos /6591 testes passaram; nenhum filtro ou ignorado.** Duração220,75s. Log local output/inbox-309-vitest-full.log. Não inclui integração de banco, que esta task não altera.
- Lint global final: Node22.23.2 node_modules/eslint/bin/eslint.js . --max-warnings 40, sessão56644 acompanhada até exit0(31842f), **0 erros /40 avisos herdados**. Log local output/inbox-309-eslint-global-final.log.
- Nenhuma mudança posterior à execução no código/testes309; apenas este registro e o quadro. Trava de fundo/paleta passaram sem exceção nova, contatos e ListaAtendimentos legados também.
- Aceite visual: sem tela própria, conforme Task4 Step5. Avatar/Badge/estado são produtores; nenhuma tela foi forçada a consumir os novos parâmetros. O aceite real em3viewports×2temas será daTask7, e não é declarado concluído nesta task.

Revisão independente do commit congelado ainda pendente. Não houve instalação, alteração de package/lock, schema, banco, servidor, transporte externo, push ou PR pelo DEV.

## QA309 R1 — P2: expansão Unicode de maiúsculas

Achado reproduzido na fonte0feb3bbf: capitalizar as iniciais juntas fazia ßeta Anna virar SSA e a ligatura ﬃona Anna virar FFIA, excedendo duas iniciais. A correção capitaliza cada inicial selecionada separadamente e retém seu primeiro ponto Unicode com Array.from. Letras fora do BMP continuam inteiras; não houve mudança de SPEC, cores, hash, medidas, selo ou consumidores.

- RED dirigido: Node22 node_modules/vitest/vitest.mjs run src/components/Avatar.test.ts -t "maiúsculas mantêm" --maxWorkers=2. Exit1(797c98),5 falhas/2 passaram/14 filtrados. Casos: ß no começo/fim, ligatura isolada/composta e combinação com Deseret; duas regressões fora do BMP já passavam.
- GREEN ampliado: Avatar/Badge/estado + paleta/fundo/contatos/prazo/lista,11 arquivos/118 testes exit0(092940), sem filtros/ignorados. Mesmo comando ampliado anterior, agora com os sete casos novos.
- Lint dirigido dos seis arquivos de produtores/testes exit0(038f6e), sem avisos.
- TypeScript Node22 heap8192 --noEmit, sessão7322 acompanhada até exit0(260afe).
- Não houve full novo nesta revisão, conforme coordenação do integrador. O full848/6591 e lint global0/40 acima são históricos da fonte0feb3bbf anterior ao fix; não validam este fix. A regressão global da combinação310+309 será do integrador.
- Re-review independente do SHA fix permanece pendente; #312 não iniciada.

## Gate global309 R2 — opacidade da expressão de iniciais

O integrador informou execução combinada285e1a66, sessão15860, exit1:850arquivos(849passaram/1falhou),6633testes passaram/1falhou. Única falha foi identificacao-registro.test.ts:260 em Avatar, pela expressão Array.from na cadeia de selecionadas.map. Não era id real, mas a análise AST falha fechada por profundidade e é gate obrigatório. O full848/6591 pré-fixR1 continua somente histórico; o global15860 não recebe aprovação.

- RED dirigido no SHA879: Avatar + identificacao-registro, exit1(efd6f4),1falha/49passaram, semignorados; reproduziu exatamente o achado opaco do gate global.
- Ruling: capitalizar e reter o primeiro ponto Unicode no flatMap original, depois retornar só primeira+última inicial. Remove a cadeia intermediária selecionadas.map e preserva ß/ligaturas/foraBMP/atéduasiniciais. Não modifica SPEC, guardas, PROFUNDIDADE_MAXIMA, exceções, cores, hash ou consumidores.
- GREEN: Node22 node_modules/vitest/vitest.mjs run src/components/Avatar.test.ts src/app/identificacao-registro.test.ts "src/app/(app)/inbox/BadgeEstado.test.ts" "src/app/(app)/inbox/estado-visual.test.ts" src/app/paleta.test.ts src/app/fundo-sobre-pagina.test.ts "src/app/(app)/contatos" "src/app/(app)/inbox/prazo-vivo.test.ts" "src/app/(app)/inbox/ListaAtendimentos.test.ts" --maxWorkers=2.12arquivos/147testes exit0(977c4e), nenhum teste ignorado nos arquivos selecionados.
- ESLint dirigido dos seis arquivos de produtores/testes, max-warnings0, exit0(20b098). TypeScript Node22 heap8192 --noEmit, sessão75216 acompanhada até exit0(267f59).
- Não rodou full novo no DEV; integrador executará global combinado após este fix. Re-review independente pendente;311 permanece só leitura, sem implementação;312 não iniciada.

## Fechamento pelo integrador — substitui as pendências históricas

Fonte309 bcda5a04bb849579dea79ef46a2ffb333b6ab6f3, TESTER re-review favorável,4arquivos83testes0/diffcheck0. P2 Unicode e gateAST encerrados, sem relaxar regra. O full15860 vermelho e o full848/6591 anterior permanecem históricos, sem reatribuição.

Global final combinado309+310 fonte103a507d8a8fda7a6758a4eee46177d4c3ce7a67, Node22.23.2, sessão15987 acompanhada atéexit0:850arquivos/6634testes semfiltro/semignorados/maxWorkers2, TSCheap8192, lintglobal0erros40avisos herdados. Logs e parecer em `output/inbox-309-qa/`. Branch309 recebeu a baseE1publicada3a; apenasquadro conflitou e foi consolidado, código309 preservado. Os arquivos depois desta revisão são docs/QA. Semsuite de integração/banco neste produtor; visual dos consumidores é Task7 conforme contrato. Pronta para PR; nenhum merge/deploy.
