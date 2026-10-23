# Coluna Conversas — #313

Task8 do plano docs/superpowers/plans/2026-10-22-inbox-prototipo-02-design.md, base dd141ac28b34c9c3d90470c60960be18b7da6a45. Implementação DEV em andamento; prova visual, QA independente e global integrado ainda pendentes. Nenhum aceite presumido.

## Escopo e composição

ColunaConversas substitui o conteúdo antigo da região Conversas do InboxNovo. Mantém a seção/geometria300/372 e a ListaAtendimentos312 (paginação, seleção e VirtualList medido); não cria consulta, SSE, permissão ou schema. O mesmo agoraInicial:number da página continua encaminhado à lista e à thread, sem recapturar relógio durante SSR. A ref real da regiãoConversa382 continua condicionando leitura; contagens310/311 continuam com suas gerações e reconciliação.

Cabeçalho Conversas, seletor, BotaoIcone34 de filtros/nova e slot do sino; busca38px, chips com agregados do servidor, filtros aplicados removíveis e slot faixaAria opcional/vazio naE1. Cabeçalho/filtros têm rolagem própria limitada à metade da coluna; a lista mantém seu scrollRef. Sem opcoesFiltro a busca/chips continuam, apenas o seletor fica ausente. Sem conteúdo de nova conversa, o gatilho correspondente fica indisponível; não se cria formulário alternativo.

BotaoIcone usa foco globalDS e tamanhos tipados28/34/36/44, com28 para Fechar. Medidas são classes literais. Ativo representa a apresentação do estado anunciado em aria-expanded pelo chamador, não força aria-pressed para um gatilho de diálogo. Controles de seleção são registrados pontualmente nos mapas, sem mudar o analisador das travas.

## URL e filtros

filtros-url compartilha paramsDaUrl com o PainelFiltros anterior, cujo arquivo/export/testes permanecem atéTask15. Formato público setor/numero/resp/status/naoLidas=1/prazo=estourado/busca preservado e codificado por URLSearchParams. Navegação usa router.replace; não carrega dados em paralelo.

Chips Todas/Minhas/Não lidas/Prazo estourado/Não atribuídas, nessa ordem. Trocar chip limpa somente as dimensões responsavel/naoLidas/prazoEstourado, preservando setor, número, status e busca. Combinações externas de duas dimensões rápidas, ou responsável específico de outra pessoa, não marcam um chip exclusivo. Agregados vêm de ContagensChipsInbox; não são contados pelos itens carregados. Grupo rotulado Filtros rápidos e aria-pressed indicam a seleção.

Setor/status escolhidos no popover são rascunho até Mostrar conversas. Limpar no rodapé aplica remoção de ambos imediatamente e fecha; chips aplicados removem só sua dimensão e Limpar da coluna remove ambos, sempre preservando os outros filtros. Não antecipar Etapa/Tags/Responsável/Tipo daE4. Busca aplica Enter e trim, limite100 existente; placeholder não promete tags. Ctrl/MetaK ignora composição, Alt, outra tecla e evento já consumido, foca o campo real e limpa listener ao desmontar.

D17: todos os papéis já autorizados do Inbox mantêm seletor. Somente Admin recebe Gerenciar números em Configurações. Opções usam id/rótulo/saúde pública, nenhum telefone nem agregação por número; ponto conectado/instável/desconectado e indicação Instável. Rótulo1 conectado no singular,0/2 conectados no plural (ruling que corrige o exemplo do plano). Seleção inexistente usa apresentação Todos os números, sem autorização nova.

## Popovers e foco

PopoverColuna é diálogo NÃO modal, sem aria-modal nem isolamento do fundo. Usa useDialogo para foco inicial/Tab/ShiftTab/Escape/retorno/pilha; gatilho não é desabilitado ao abrir. Posição56/72 na coluna; abaixo700 vira folha85dvh com corpo rolável e rodapé separado, sem alterar os cortes960/1400 da casca. Um único popover fica aberto; seletor possui modo controlado opcional aberto/aoMudarAbertura e modo autônomo abertoInicial.

InboxNovo é dono da abertura de Nova conversa por novaConversaAberta/aoFecharNovaConversa; uso autônomo da Coluna funciona sem esses opcionais. Conteúdo é o único NovoAtendimento compacto. Compacto retira somente moldura/padding do formulário; destinatário, linha comercial, impedimentos, action, chave idempotente e router.push existentes não foram reimplementados. D9/telefone novo ficam na372.

Ruling técnico autorizado: useDialogo acrescenta focoAoFechar?:RefObject<HTMLElement|null>. Ausente conserva exatamente o elemento capturado; fornecido lê .current na limpeza e null suprime retorno. Referência/valor atualizados sem reinstalar listener; isolamento é solto antes do foco. Coluna mantém alvo mutável estável, guarda o gatilho no handler e escolhe busca antes de fechar por CtrlK. Não há leitura/escrita DOMref no render. Nenhum outro consumidor foi migrado.

## Integração de navegação do App Router

Ruling313: somente mudança real de selecionadoInicial recebido sincroniza a seleção; seleção local permanece se a prop não mudou. Mudança de filtro concorrente usa a nova página junto do novo c, fecha Nova e escolhe vista correspondente. Navegar c→null invalida leitura pendente da conversa anterior; consultas iniciadas antes da navegação são invalidadas pela geração existente. Não muda action/permissão/idempotência.

No layout anterior ao cleanup passivo, Inbox escolhe a regiãoConversa realmente visível como destino de foco quando c muda; para lista escolhe a busca. RegiãoConversa recebe tabIndex=-1 sem entrar na ordemTab. Assim fechar Nova e ocultar a coluna no celular não tenta devolver foco ao gatilho escondido. Ref382/visibilidade/document.visibilityState e proteções de leitura/SSE permanecem.

## Provas e pendências

Checkpoint pré-merge314: recorte92arquivos869testes/TSCheap8192/lint28fontes0avisos com EXIT0, logs/negativos em output/inbox-313-report.md. Tests de React DOM real sobre DOMmínimo cobrem foco, URL, retorno explícito/null/isolamento e navegação. Geometria390 desses testes é explícita; não substitui Chrome/CSS real. Somente ícones decorativos e fronteiras externas de roteador/servidor/SSE foram substituídos onde necessário.

Antes de aceite: incorporarA243 preservando autoria/dias/notas/stableMount e SSR; deltaCLI coordenado filtros/seletor-numero/nova-conversa, preservando estados314/guardReact/anonimizaçãoDOM/hidratação. Prova real nos3viewports/2temas, inclusive390×500/rodapé/foco/pilha e lista>100 após integração. Nenhum servidor/DB/seed/dependência acionado pelo DEV. PNGs locais/hashes/ZIP autorizado, sem novos binários emGit; QAexata/global/publicação pelo integrador.
