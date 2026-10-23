# SDD ledger — plan: docs/superpowers/plans/2026-10-22-inbox-prototipo-02-design.md · Task8/#313

Branch codex/inbox-e1-313, BASEdd141ac28b34c9c3d90470c60960be18b7da6a45, checkout43fbf3 EXIT0;312 permanece congelada4b6f1554. WorktreeOWNB, perfildev-gravacoes preservado com150casos; nenhum DBsuite/seed/servidor/transporte/install/package/lock/PR/push DEV. Node22 local. Execução inline do brief completo aprovado; etapa ainda EM ANDAMENTO, sem homologação.

## Pre-flight e rulings autorizados

- Coluna313 consome ContagensChips310,Lista312/relógio, casca308/refConversa382 e agoraInicial único. Não cria rede; não editaVirtualList. API/scope/gerações anteriores preservados. Parent aprovou desenho/contratos antes do código.
- Ruling: BotaoIcone inclui28 tipado porque o próprio plano o exige em Fechar; rótulo1 conectado no singular. Combinações rápidas externas não recebem chip exclusivo.
- Ruling: Seletor opcional controlado aberto/aoMudarAbertura preserva abertoInicial autônomo. Coluna recebe novaConversaAberta/aoFecharNovaConversa opcionais; Inbox dono único no uso integrado. Um popover, não-modal/useDialogo/semaria-modal; nenhum gatilho desabilitado por estar aberto.
- Ruling: Limpar do rodapé aplica remoção setor/status e fecha; escolha de opção é draft até Mostrar. URL real preserva demais dimensões.
- Ruling: sincronizar somente mudança REAL da prop selecionadoInicial, conservando seleção local se prop igual; cobrir c→novo/null, filtros concorrentes e leitura anterior. action original intacta.
- Ruling compartilhado explícito do integrador: focoAoFechar opcional no useDialogo. Ausente retorna capturado, refnull suprime; última referência sem reinstalar listeners, soltar isolamento antes de foco. Coluna/Inbox escolhem busca/conversa em handler/layout antes do cleanup. Não migrar OptOut/outros consumidores.
- Ownershipharness A314 respeitado: nenhum arquivo scripts/visual ou CLI alterado. Após freezeA243c9348454b6cca5795a6afa747efa25ed3eef1, proposta de delta aprovada; incorporar essa base somente após este checkpoint, sem wholeours/theirs, preservando contratos314/stableMount. Ainda não incorporada.

## TDD/gates observados antes do merge314

- 58f49c EXIT1:5 suítes novas ausentes/0testes, antes dos produtoresURL/Chips/Seletor/Popover/BotaoIcone. GREEN8e7580 EXIT0:5arquivos11testes. Argumento PainelFiltros.test.ts não existia e não conta como arquivo executado; teste antigo de export/API preservado no recorte real.
- fadbcb EXIT1: Coluna ausente e2falhas/21pass em Inbox/Novo (não atribuídas/compacto ausentes). b22116 EXIT1:6 interações falham por Coluna ausente. 6a003f teve1falha/32pass: teste de padding procurava substring p-3 e atingia gap-3; corrigido para token, sem mudar produto.
- b805b9 EXIT1: hook realReactDOM,4falhas/1defaultpass, retorno explícito/null/layout ainda ausentes. e78046 EXIT0:5arquivos40testes com padrões/pilha anteriores, extensão eCtrlK/compacto.
- dffc99 EXIT1: testes de navegação nova/null/pending falham. O teste de filtro concorrente precisava segundo render no harness semDOM, que não re-renderiza estado derivado automaticamente; sua asserção é regressão do contrato prévio, não bug novo. Após sincronização,520d14 ainda1falha/62pass: GET anterior ao novo c reaplicava lista antiga. Geração existente passou a invalidar também mudança real da propc. c450f0 EXIT0:3arquivos63testes, sem relaxar geração/ref382.
- ebe558 EXIT1:2testes de focoInbox atingem limitação select.options do DOMmínimo. Getter somente no teste, não produto/helpercomum;3dd818 EXIT0/2testes. Fronteiras backend/thread/ícones substituídas, Inbox/Coluna/Popover/form/hook reais; geometria explícita, prova Chrome pendente.
- Primeira ampla51426/d82c7f EXIT1:92arquivos/869testes,6falhas/863pass; somente mapasbotões/fundo/IDcontrole. Registros exatos adicionados, chips agora grupo rotulado. Nenhum analisador/limite/whitelist global alterado; única âncoraIDcontrole para selecionado={filtros.numeroId??null}, copia literal correspondente preservada. 0d19a1 EXIT1/1falha97pass exigiu essa segunda cópia da lista de exceções; ambas explícitas.
- TSC80536/d80170 EXIT2:3atribuições a RefObject readonly +1cast de fronteira de teste. Props mutáveis só nos donos do alvo; helper continua leitor RefObject, sem castprodutivo. Lint8d7938 tinha6erros, depoisb839a7 só1 por aliasref. Ref nomeado com sufixoRef e handlers antes dos efeitos, sem disable.
- Tentativa de testes JSX .test.tsx foi OMITIDA pelo include .test.ts existente: recorte19431/6dc15c EXIT0/90arquivos862testes é INCOMPLETO para esses2novos testes. Restaurados nomes .test.ts sem alterar config; fixture de montagem JSX sótestes em src/test/dialogo-retorno.test.fixture.tsx, importada pelo teste. 4ee7c8 EXIT0/2arquivos7testes efetivamente rodados;7c03cb lint4fontes EXIT0. Node9f9e8d tinha lint3erros antes de Vitest0; não é gate lint verde.

Gates finais do checkpoint, mesma fonte produtiva:
- sessão80183/1563a1 EXIT0:92arquivos869testes, sem ignorados nos arquivos selecionados; recorte amplo, NÃO suíte global. Inclui Inbox, todos componentes, diálogo(default/pilha/retorno), botões/vazios/paleta/fundo/campos/identificacao e guardprovedores.
- sessão69361/9655ab TSCheap8192 EXIT0.
- 4ad167 ESLint28fontes afetadas EXIT0/0avisos ESLint (mensagens CRLF são do git de descoberta). gitdiff--check6017f1 EXIT0.

Comando do recorte:
Node22 node_modules/vitest/vitest.mjs run "src/app/(app)/inbox" src/components src/lib/dialogo.test.ts src/lib/dialogo.interacao.test.ts src/lib/dialogo-retorno.interacao.test.ts src/app/botoes.test.ts src/app/estados-vazios.test.ts src/app/paleta.test.ts src/app/fundo-sobre-pagina.test.ts src/app/campos.test.ts src/app/identificacao-registro.test.ts src/server/whatsapp/sem-provedores-legados.test.ts --maxWorkers=2

## Pendências obrigatórias

MergeA243 e recortes SSR/interação/virtual; deltaCLI aprovado filtros/seletor-numero/nova-conversa com hidratação/Reactguard/anonimizaçãoDOM apósinterações/estados314 mantidos. Ambiente/prova visual sócomliberaçãointegrador, incluindo390×500/rolagem/rodapé/retorno/pilha, contador real eVirtualList>100/stableMount. Sem executaractionNovo/enviar. Capturas locais/hash/ZIP remoto autorizado e semPNGcommit. TESTER exato, global integrado e publicação permanecem do integrador. Task8 não concluída neste checkpoint.
