# QA geral independente #350 — final85e5cc7c / runtime4b682c91

Fonte exata **85e5cc7c9a7112d12a8bb464ac12d673740c2a1f**, runtime **4b682c913e02960cb6a3ee7b5400476d14114379**, base Mainfabf7addf291de6e4b821927cfc1c88ce93bd9fb. Parecer favorável ao código e ao recorte geral executado:26 arquivos completos/555 testes e lint18 terminaram0. Nenhum bloqueador novo de runtime identificado nesses recortes. Não conclui a issue, não é suíte global e não homologa TSC original, integração, interface nativa ou36 imagens ainda pendentes.

## Ambiente, fonte e gates próprios

Own TESTER mudou de f948 para detached85 em86d934 EXIT0 após tracked limpo e hash dos privados importantes. RED350, pareceres344/345 e provas V1/V2/WS tardio328 foram preservados, sem editar outro checkout ou suas fontes. Cliente490/perfiltester/banco492 mantidos; nenhum DB acessado e nenhum restaurador usado. Privados328 continuam nominais às suas fontes antigas e não foram reexecutados por este checkout.

| Gate próprio | Sessão/terminal | Resultado |
|---|---|---|
| UNIT geral pertinente completo | 29371/841fc4→a031a2 | EXIT0;26 arquivos/555 casos,102,87s |
| ESLint dos18 paths SRC/testes da entrega | 02df44 | EXIT0;18 arquivos,maxWarnings0,sem erros/avisos |
| FS/Git de identidade | eacaac | EXIT0;21pins/15protegidos/12AST por congruência literal |

Node22 local, heap512MB e maxWorkers1; configuração UNIT original. Sem -t, filtros, skips, timeout modificado, global, TSC, integração ou nova captura. Acompanhei a MESMA sessão29371 até seu terminal, sem reinício. Lint começou depois do terminal UNIT. Nenhum executor TESTER permanece ativo; janela foi liberada ao ROOT. Aviso vite-tsconfig-paths foi mantido no log.

## Lista exata dos26 arquivos completos

Comando: C:/Users/Mendes/AppData/Local/hermes/node/node.exe --max-old-space-size=512 node_modules/vitest/vitest.mjs run com TODOS os paths abaixo e --maxWorkers=1. A lista foi verificada como26 únicos existentes antes de executar, gravada em output/inbox-350-85e-unit26-lista-tester.json.

~~~text
src/app/(app)/inbox/aria/CartaoSugestaoAria.interacao.test.ts
src/app/(app)/inbox/aria/CartaoSugestaoAria.test.ts
src/app/(app)/inbox/aria/intercalar.test.ts
src/app/(app)/inbox/aria/sugestao-visual.test.ts
src/app/(app)/inbox/ConversaAberta.test.ts
src/app/(app)/inbox/ConversaAberta.rodape.test.ts
src/app/(app)/inbox/ConversaAberta.mencoes.interacao.test.ts
src/app/(app)/inbox/ConversaAberta.busca.test.ts
src/app/(app)/inbox/InboxNovo.test.ts
src/app/(app)/inbox/InboxNovo.interacao.test.ts
src/app/(app)/inbox/InboxNovo.detalhes.test.ts
src/app/(app)/inbox/InboxNovo.foco.test.ts
src/components/conversa/itens-thread.test.ts
src/components/conversa/VirtualList.test.ts
src/components/conversa/VirtualList.estavel.test.ts
src/components/conversa/virtual-window.test.ts
src/components/conversa/historico-conversa.test.ts
src/components/conversa/agora-thread.test.ts
src/app/(app)/inbox/busca-conversa-virtual.test.ts
src/lib/acao-cliente.test.ts
src/components/Botao.test.ts
src/app/botoes.test.ts
src/app/paleta.test.ts
src/app/contraste.test.ts
src/app/enums-rotulos.test.ts
src/app/(app)/inbox/aria/CartaoSugestaoAria.foco.test.ts
~~~

Essa é a lista25 nominal do report mais o arquivo novo de foco11. Os555 são a contagem REAL desta execução no85, não544 DEVb0be reatribuídos, nem soma de recortes anteriores. O teste focoB contém seis oráculos privados anteriores; não adiciono outra vez os seis como casos únicos a esse total.

## Lista exata lint18

Executável instalado node_modules/eslint/bin/eslint.js, heap512, paths abaixo, --max-warnings=0. Lista derivada dos paths SRC do manifesto final21, não de um glob aproximado; arquivo output/inbox-350-85e-lint18-lista-tester.json.

~~~text
src/app/(app)/inbox/ConversaAberta.test.ts
src/app/(app)/inbox/ConversaAberta.tsx
src/app/(app)/inbox/InboxNovo.interacao.test.ts
src/app/(app)/inbox/InboxNovo.tsx
src/app/(app)/inbox/aria/CartaoSugestaoAria.foco.test.ts
src/app/(app)/inbox/aria/CartaoSugestaoAria.interacao.test.ts
src/app/(app)/inbox/aria/CartaoSugestaoAria.test.ts
src/app/(app)/inbox/aria/CartaoSugestaoAria.tsx
src/app/(app)/inbox/aria/intercalar.test.ts
src/app/(app)/inbox/aria/intercalar.ts
src/app/(app)/inbox/aria/sugestao-visual.test.ts
src/app/(app)/inbox/aria/sugestao-visual.ts
src/app/botoes-mapa.ts
src/app/botoes.test.ts
src/components/Botao.test.ts
src/components/Botao.tsx
src/components/conversa/itens-thread.test.ts
src/components/conversa/itens-thread.ts
~~~

O log lint18-executor registra contador e exit reais do invocador; o ESLint em si foi silencioso. Não se trata de log de diagnóstico inventado ou repetição para gerar saída.

## Identidades e preservação

Li integralmente report DEV9.726bytes/053b2eff0013603b4be981f0f8b102a58479c2aea3a4535fc8080b6edf09f558 e manifesto final13.878/b4d33a616f11dccd6fd107199d7f630aebf221444f4f3ea35e62ca65becd44c6. Os21 paths/OIDs/bytes/SHA GitLF conferem na fonte85 e a cópia física própria recompõe cada blob normalizando CRLF, sem confundir hashes Git/Windows.

Todo o escopo executável src/scripts/prisma/.github/package/lock é idêntico entre85 e4b; o fechamento final só altera três documentos. Os15 protegidos de backend/DTO349/ACL/histórico/actions/permissões/hooks/VirtualList/PainelAria/schema/deps continuam literais à Mainfabf. Outros paths fora da entrega também preservados em relação à base. InboxNovo conserva a mudança aditiva única da aria do painel atual.

As12 funções/constantes antigas de itens-thread/Botao já foram comparadas por AST no b0be. Nesta revisão confirmei identidade literal dos dois módulos inteiros85 versusb0be; logo a prova das12 é transitiva por OID, não alegação de novo teste AST ou remoção do decorator alterado de seu escopo correto. Card corrigido permanece5.335bytes/a36d2b135849e8959b994141b014b7c6eaa68c4cba21952c9b77d5787dadd573.

## Contratos revistos e exercitados

Sugestões vêm do DTO autorizado349 do atendimento atual, sem payload bruto, consulta por cartão ou decisão ACL cliente nova. Backend/ações349 continuam com fresh role/escopo/locks/status/expiração/idempotência. podeDecidir do lead do atendimento não oculta cartão autorizado por outro alvo da ação. D1/D2 aprovadas permanecem354–356, sem antecipar edição/pacote.

Intercalação por epoch acontece ANTES do decorator; empate conserva itens existentes primeiro, datas/keys/cursores de mensagens/notas mantidos e sugestão rompe sequência. Keys sugestao-aria:id são próprias. Projeção usa detalhe tipado, labels únicos, data/fuso explícitos e escape React; false/0 não somem. Busca/histórico/compositor/VirtualList não foram reescritos para acomodar cartão. O teste consumidor usa o núcleo real e keys legadas, mas não é navegaçãoTab/ancoragem visual nativa.

Prop aria é somente painelDoAberto do ID selecionado e some ao mudar de contexto até carregar o atual. Executor/trava de clique duplo, erro de negócio/expiração, transporte incerto, retry manual e ACK desmontado permanecem. O fix mantém região status antes da decisão e foco conectado significativo quando remove controles possuídos pelo cartão, sem roubar foco externo. O arquivo foco11 cobre ACK/SSE antesACK, decisão remota sem nossaaction, foco externo, erro, ACKantigo e blur emulado. O percurso foi RED em b0be e GREEN em4b antes do geral; esse histórico continua nominal.

perigoContorno é opt-in com tokens/foco/disabled/tamanho preservados. Quatro classificadores mantêm conjunto exato perigo/perigoContorno e recusas de opacos/condições/ramos; mapa registra dois botões e a entrada dinâmica exata é ancorada em AST da projeção e seus dois filhos. Guardas completas botoes/paleta/contraste/enums fazem parte dos26 executados. Não houve relaxamento genérico de resolução de rótulos.

## Histórico e qualificação documental

O primeiro RED TESTERa25472 permanece EXIT1,4 falhas/2 controles em6. O GREEN causal privado660937/6, arquivoB b9a29d/11 e lint2 01110b são execuções sobrepostas no4b, preservadas em c8ecd91b823ea7e7440b6443e5420b82e9133833c7c7cd8a9115ded56822d88a. Não são reatribuídos à primeira candidata e não viram555 por soma.

UNIT DEV25/544 em b0be, negativosSVG/setup, guarda12/424 com duas falhas reais, REDfoco9/11 e TSC ORIGINAL80288/44bd90 EXIT2 com três diagnósticos permanecem íntegros. O único genérico explícito do teste intercalar não altera runtime ou asserts. TSC AUXILIAR92312/b61820 é prova DEV qualificada com apenas duas exclusões privadas históricas; não o executei nem o chamo de original/global aprovado. TypeScript original/global/CI da árvore integrada continuam próprios gates ROOT.

Indicação editorial concreta enviada ao ROOT: report85 diz que o controle removido deixava foco no BODY. Nosso RED registrou focoSignificativoDentro=false no DOM mínimo, sem observar Chrome/BODY nativo. O wording correto deve descrever perda de foco conectado/contextual e ausência de anúncio; blur no controle B é emulação deliberada. Isso não bloqueia o runtime corrigido ou os gates deste parecer, mas não deve ser publicado como observação nativa ausente.

## Evidências e limites finais

- output/inbox-350-85e-unit26-tester.log: 489bytes/SHA25688d5ccbc7de0b2a520f5784b96b69e31471007c62d5e4dcb644f90590d1b2a6a
- output/inbox-350-85e-lint18-executor-tester.log: 46bytes/SHA2567b77b90d94580b402bca28fe95bf938c2d5b008608cd39efc3702c4dd036f962
- output/inbox-350-85e-unit26-lista-tester.json: 1271bytes/SHA256c438042051ae9ebe566522d1d240729946ad55de41611578c08f25debeed5fe6
- output/inbox-350-85e-lint18-lista-tester.json: 837bytes/SHA256f0049e2fd219b019a1c512d24ae16256b0b0b53164a07ba1b20491ee48dd9385
- output/inbox-350-85e-identidades-tester.json: 12256bytes/SHA2564ac598a62473c2112c0329b7afa4b74bdcd5abc6fc6abc0d122093e0b9c35d21

Resultados estruturados: output/inbox-350-85e-final-resultados-tester.json com listas completas, comandos/gates, runtime/base e pendências. Os logs e provas de outras fontes não foram sobrescritos.

Não houve DB/TSC/global/HTTP/browser/install/generate/DDL/build/fixture/provider/captura ou ação de negócio real pelo TESTER. A correção DOM/role status não comprova anúncio audível por leitor de tela, focoTab/clipping/móvel ou pixel real. O plano atualizado prevê18pares/36PNGRAW (seis primários+12 complementares), ainda pendentes de fixture/pins/GO/inspeção ROOT; nenhum deles foi homologado por UNIT.

Eventual integração pertinente precisa de coordenação/lease, e união328/344/345, visual/nativo, CI, revisão/publicação/merge continuam pendentes. Recomendo aceitar código85/src4b para a próxima etapa coordenada preservando esses limites; não marcar #350 concluída.