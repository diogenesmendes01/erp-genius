# Relatório DEV A — Inbox #308

## Correção posterior do integrador — prontidão da captura

A revisão de código no SHA664eedf2 foi favorável (TESTER146testes dirigidos exit0). Na UI combinada c7e85eb2, a TESTER preservou captura34498 exit1: warning exclusivamente do estilo caret-color:transparent, injetado por screenshot antes da hidratação do input Buscar. Probe independente reproduziu1/5 sem espera e0/5 após data-conectado=1; código da Inbox não contém esse estilo. O integrador passou a aguardar a assinatura cliente após o conteúdo e antes da foto, preservando todos os diagnósticos.

TDD do delta:359f85 exit1 com2falhas/17pass; GREEN955e1b exit0/19testes e lint dirigido0. TSC492ab1 exit0. Não altera código de produto, estilo ou comportamento do Inbox. Global anterior46900 no c7e85eb2 terminou exit0:857arquivos6663testes/TSC/lint0erros40avisos. A nova fonte do harness será verificada em novo global e captura; não atribuir a essa fonte a execução anterior. A captura canônica24284 c7 gerou38PNGs/0falhas16diagnósticos de GET recuperado, preservados em output/inbox-308-311-combinado.

## Estado e recorte

Branch codex/inbox-e1-308, base103a507d; somente worktree inbox-dev-a. SPEC docs/specs/inbox-casca-tela-cheia.md; plano/decisões output/inbox-308-plan.md. Banco dev-email reservado à UI, preparado pelo integrador; nenhuma integração truncante, seed, schema ou instalação executados pelo DEV. Preview3110 iniciado pelo integrador, sessão75098, Node22 e transportes vazios. Push/PR/publicação são do integrador.

Casca em tela cheia sem moldura; uma montagem de painel com conteúdo atual; controles de sino/Novo preservados em ponte funcional; limites locais960/1400 medidos para Sidebar224 e compositor humano; foco/SSR/resize/semântica; CLI/esperas adaptados. Lógica de leitura/count/SSE310 não modificada.

## TDD e verificação observada (Node22.23.2)

- RED inicial8f9be9: painel duplicado, moldura antiga, aside sem seleção e helper ausente;38 testes antigos verdes. RED SSR funcional b7fa47: classes/ponte antigas;12 verdes (erro de sintaxe do mock em a4d15d corrigido antes do RED funcional).
- RED foco b5a456: componente ausente. GREEN inicial7d4218:6arquivos84testes; lint5fontes831643 exit0. Teste adicional777800 reproduziu abertura manual em coluna sem foco. Corrigido; shim DOM local completado com querySelector, sem alterar utilitário compartilhado; f18ec3 exit0 com3 testes DOM reais.
- RED transição uma→três86c706: preferência manual sobrescrevia reset automático. Corrigido somente estado visual;82c9aa exit0,27interações incluindo guards310.
- RED harness3cb2c1: estado painel-fechado ausente e espera exigia painel fechado visível;14 antigos verdes. GREEN4ca86a exit0,16testes. RED diagnósticoReact3021bb: helper ausente; GREEN06256b exit0,2arquivos30testes (SSR+harness).
- Recorte amplo37587/72ee40 exit1:392passes/4falhas na trava de botões. Controles novos convertidos para Botao e mapa exato de labels atualizado; nenhuma isenção ou enfraquecimento da trava. GREEN4808e5:67testes0. Recorte amplo29081/30909c:30arquivos396testes0, sem ignorados, inclui Inbox, harness, botões/paleta/responsivo/borda-rota e Sidebar/BarraMobile/Trilha. A inclusão posterior do diagnóstico React é coberta pelo GREEN06256b; revalidação final a registrar.
- TSC90523 exit1 por dois tipos dos testes DOM, corrigidos;38303 exit1 por cast de teste, corrigido. TSC7301 e67506 exit0 (heap8192, tiposNext presentes). Apenas key/diagnóstico posteriores: repetir no congelamento.
- Lint dirigido c74bc8 exit0,0avisos, após corrigir uso children-prop do teste. Novos controles usam Botao e mapa explícito. Sem novo aviso React purity/set-state-in-effect.

## Provas reais no aplicativo

- Geometria13528 exit0:34 contextos (17larguras×2temas), com compositor humano preenchido/Enviar, sem overflow/documento rolando/controles fora. Probe a47f4d exit0:9larguras impostas temporariamente no nó real; fonte/controle inalterados, estilos restaurados; não é screenshot de aceite. Campo105,28 em thread320 versus221,28 no corte960 e241,28 no corte1400.
- Interação6936 exit0:32contextos (16tamanhos/alturas×2temas) +2resizes, abertura/Tab/Escape/retorno, mesma montagem, formulário aberto e último botão alcançável, sino real sem abrir destino. Inclui altura500. Primeira tentativa43484 falhou por seletor type=submit inexistente (botão é implicitamente submit); seletor corrigido, produto intacto. Script nunca clica submit/Enviar.
- Console acrescentado à prova:82797 exit1 por warning de key React, embora34geometrias passassem. Negativo preservado em medidas-chave-ausente.json. Causa na origem do sino ReactNode passado pela página. Adicionada key explícita. Repetição43958/7c1894 exit0:34geometrias, zero warnings de chave/hidratação/pageerror. Não foi tratado como defeito preexistente.
- Captura formal inicial3349/c1e75c exit0:38PNGs (20app+18protótipo),4.044.244bytes, todos sem pageerror/rede externa. Esse CLI ainda não detectava warning de console; manifesto inicial preservado, sem chamá-lo de aceite final SSR. Após ampliar diagnóstico, repetir app20. Protótipo/cache original não editados e não precisam ser repetidos por key exclusiva do app.

## Limites e pendências

Não é alegado aceite visual independente. TESTER deve inspecionar SHA exato e fotos; global depende da janela coordenada. Conteúdo interno ainda antigo, com Sidebar global224 preservada contra rail64 da referência; ajuste local de700/1100/1200 documentado com dados, sem reduzir navegação ou compositor. Sem ações externas ou reais, nenhum submit/cadastro/envio, sem alteração de pacote/lock/permits. Artefatos privados antigos, seeds e credenciais não entram no commit.

## Fechamento DEV observado

- Recorte final Node22.23.2: sessão94381/3868e1 exit0,33arquivos420testes, sem ignorados. Filtros: pasta src/app/(app)/inbox + visual-inbox.test + botoes/paleta/responsivo/borda-rota/borda-rota.render + Sidebar/Sidebar.tema + BarraMobile/BarraMobile.navegacao + Trilha. Não é full. Comparado ao recorte407, inclui2testes novos de isolamento e11testes adicionais da guarda SSR de borda-rota.
- TSC heap8192 com tiposNext presentes:12959/8e0ac7 exit0. Tentativa74094 falhou somente pelo narrow de tipo do helper local, corrigido antes do gate final. Lint dirigido de todos TS/TSX/MJS/MTS alterados e cinco helpers QA:e12dff exit0/0avisos. Sem mudança de produto após esses gates. Global combinado308+311 é do integrador; nenhum full próprio iniciado.
- Confirmação filha: RED unitário4f3643 e navegador83466/0511c1; guard local de Escape evita consumir evento de portal/alertdialog. GREEN DOM94e22a; navegador fecha só confirmação, painel permanece nos3tamanhos. O foco BODY é preexistente (OptOut desabilita origem), confirmado pelo integrador nas bases103/130 e explicitamente fora do escopo; negativo dialogo-filho-foco-preexistente.json preservado. Nenhuma confirmação enviada.
- Isolamento modal: probe935605 provou fundo clicável/AT apesar de aria-modal; RED2/6 a3daa4; helper local com efeitos ordenados e GREEN6/6 2bdbc9. Preserva inert preexistente, solta no layout antes de devolver foco, libera em coluna/unmount. Não modifica Drawer/useDialogo/OptOut.
- Probe final Chrome/CDP e7fb34 exit0 em1024/390: lista/thread/Sidebar inert e AXignored, Novo fora AT e clique não recebido, resize1400/959 solta fundo. Primeira verificação usou ariaSnapshot textual do Playwright e falhou por esse snapshot incluir inert; trocada por árvore AX real do Chrome, não por remoção da exigência. semantica-overlay-antes.json preserva negativo funcional.
- Interação final pós-isolamento sessão28576 exit0:32contextos+2resizes, foco/Tab/Escape/retorno, formulário/último botão, sino e zero warningsReact/pageerrors. A mesma sessão executou antes o probe com premissa ariaSnapshot inválida (exit1) e a confirmação filha (exit0), sem esconder a falha anterior; probe CDP final separado e7fb34 exit0. Execução1513 anterior também exit0, histórica antes do isolamento.
- Captura formal repetida ambos/todos47642/66757a exit0:38PNGs,4.043.953bytes,0falhas com guarda de console ativa. Manifesto-final tem SHA256 de todas,22selecionadas/2.506.194bytes. Seleção inspecionada individualmente (12conversas+10estados complementares). Todos38PNGs preservados em formal/ após pedido explícito do integrador, hashes conferidos e16adicionais inspecionados. Fotos precedem os ajustes finais de Escape/inert sem mudança de aparência; não são prova desses comportamentos, cobertos pelos probes finais acima.
- Mais2PNGs inspecionados:390x500-light-formulario-final.png e dark equivalente, tirados imediatamente após scrollIntoView do botão, antes de voltar ao sino. Botão inteiro visível, topo do formulário fora da janela pelo scroll interno esperado, lista preservada; fixture não tem destinatário autorizado, submit permanece desabilitado por regra existente. As fotos iniciais não foram sobrescritas. Toast Nextdev aparece nas fotos complementares e não cobre controles.

Pendências: revisão independente do SHA, aceite visual pelo TESTER e global integrado coordenado. Nenhum aceite presumido. Fotos de conteúdo interno antigo são coerentes com o escopo da casca; rail/proporções globais e recursos futuros da referência não são implementados nesta issue. Por ruling final entram38formais+2formulário rolado (40PNGs); logs, seed, credenciais e artefatos privados antigos ficam locais.

Preview75098 encerrado pelo integrador após auditorias, Ctrl+C/exit1 observado por ele. AGENTS conferido: somente bloco automático Next10linhas; restaurado após stop. Nenhuma modificação de produto posterior aos gates finais. Artefatos finais40PNGs/4.127.145bytes, todos individualmente inspecionados; manifesto-publicado.json guarda hashes. O índice22é apenas resumo, não omite arquivos do PR.
