# #319 — checkpoint estático dos estados do Inbox

OWNbranch codex/inbox-e1-319, base29479848432d2b4fd37972f104b6b7e5cae62368. Fonte aprovada da316/315/396 mantida; não houve checkout/edição de outro worktree. Implementação estática pronta para revisão e integração com A317, mas UI/QA/global/publicação ainda pendentes. Nenhuma captura foi produzida ou alegada nesta etapa.

## Delta e rulings

Quatro fontes produtivas: Esqueleto.tsx (casca real960/1100/1400, novos EsqueletoThread/Painel com anúncios), ConversaAberta.tsx (somente estados internos de thread/anteriores/erro e handoff local), InboxNovo.tsx (render de painel loading/erro e sem seleção), PainelSetor.tsx (ausência neutra). Nenhum contrato de props/hook compartilhado mudou.

Ruling aprovado: skeleton inicial exige ausência de mensagens E notas para não ocultar #388; EsqueletoPainel é apenas corpo, pois avatar/cabeçalho já estão no PainelContato #318. Esqueleto da página contém seu próprio avatar132 e um marcador de título, com CSS idêntica aos limiares reais da casca. Não usa painel1200 ou min-height420 históricos. Busy/retry mantêm conteúdo virtual e não expõem ErroFonte/status/URL/corpo.

Handoff síncrono antes do retry/anteriores ao campo de busca quando aberto, senão regiãoConversa; no painel, ao elemento real existente. Nenhum restore assíncrono. Comparação6d488f confirmou todo bloco inferior Compositor/ações/CabecalhoControlado byte-igual294 e hooksInbox de URL/leituraR6/fila394/SSE396/painel iguais294 (normalizando só CRLF). Mudou só a apresentação após os hooks. A317 poderá conciliar seu coordenador externo e idempotência sem perder esses estados internos. scripts/visual/CLI/núcleo/esperas/README permanecem intocados e reservados a A317.

## TDD e negativos preservados

- RED6ce4e8 saída1:9falhas/1pass/146skip no filtro319. Duas falhas eram exports dos novos esqueletos ausentes; as demais demonstravam casca antiga, loading sem anúncio, erro técnico exposto/semretry, ausência de alerta do painel, semseleção e estilo vazio. RaceA→B já passava. Recorte filtrado, não suíte completa.
- FocoRED inicial9b9bb1 incluiu um seletor de teste que achava ancestral em vez do botão; corrigido somente o seletor. REDfiel3f6a9a saída1:2falhas/1pass/7skip — retry inexistente e anteriores não entregava foco antes da carga. Não mudou produção para acomodar a seleção do teste.
- Script privado de aplicação teve erro de sintaxe detectado por node--check5613b3 antes de qualquer escrita produtiva; corrigido no próprio script privado. Nenhum helper temporário foi incluído na entrega.
- Primeiro GREEN46191c:12pass/1fail/153skip. A falha era cronologia do render manual da fixture: após retry faltava renderizar o efeito antes de aguardar. Acrescentado render imediato; produtor inalterado por isso. GREEN8ba89d saída0:7arquivos185testes sem filtro/skip.
- Handoff do painel: retirada temporária só da linha de foco produziu RED1fail/77skip; original restaurado emfinally. GREENbff840 saída0:1pass/77skip. DOM mínimo real comprova foco antes da remoção e respeito ao foco externo depois da resolução; não mede geometria de browser.
- Recorte5807 terminou saída1:61arquivos847pass/11fail. Nove falhas vinham do mock de ícones do teste DOM de foco sem IconMessages novo; duas eram registros de botões ainda antigos. Acrescentado ícone ao mock, três entradas exatas no mapa e removida somente a isenção raw de Mensagens anteriores, agora Botao. Sem alteração de algoritmo/limites/whitelist genérica.
- TSC62726 terminou saída2 somente pela fixture respostaPainel: retorno declarado Response não permitia as novas Promises diferidas. Tipo corrigido para Response|Promise<Response>, com Promise<Response> explícita. Não era erro produtivo nem problema de cache gerado.

## Gates finais observados

- Recorte9927 saída0:61arquivos861testes, sem filtro por nome ou skip, maxWorkers2. Inbox inteiro; Esqueleto/visibilidade; VirtualList/histórico; borda-rota render/estática; botões/estados-vazios/paleta/feedback; identificação/confirmações; SSE compartilhado; APIpainel. Não é global.
- Typegen anterior concluído; TSC13787 heap8192 terminou saída0 observado na mesma sessão. Nenhum arquivo gerado foi incluído.
- ESLint13fontes688eae terminou saída0, zero avisos. Diffcheck no freeze terminou com saída0. Aviso de vite-tsconfig-paths preservado no log, sem mexer em dependências.

Comando dirigido Node22 local: vitest run src/app/(app)/inbox src/components/Esqueleto.test.ts src/components/Esqueleto.visivel.test.ts src/components/conversa/VirtualList src/components/conversa/historico-conversa src/app/borda-rota.render.test.ts src/app/borda-rota.test.ts src/app/botoes.test.ts src/app/estados-vazios.test.ts src/app/paleta.test.ts src/app/feedback-separado.test.ts src/app/identificacao-registro.test.ts src/app/confirmacoes.test.ts src/lib/eventos-inbox.test.ts src/app/api/inbox/atendimentos/[id]/painel/route.test.ts --maxWorkers=2. TSC --noEmit --pretty false; eslint nas fontes/testes/mapa afetados. Logs positivos/negativos privados em output/inbox-319-*.log, foraGit.

SPEC docs/specs/inbox-estados.md. Ainda faltam TESTER exato, integração dos fragmentos A317, handoff do harness e prova visual obrigatória (5estados/3viewports/2temas,320×500 e complementos de retry/partials/foco), medição de geometria e globalROOT. Protótipo não prevê todos os estados; ausência de referência será explícita, sem fabricar comparativos. Não marcar319concluída no quadro enquanto isso faltar. Sem ownfull, DB/seed/SQL, servidor, envio ou integração externa; banco B permanece reservado/restaurado pelo integrador.
