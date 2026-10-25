# Inbox #350 — cartão Aria sugere na thread

O Inbox apresenta cada sugestão já autorizada pela #349 na posição temporal da conversa. O cartão mostra título, justificativa, texto/detalhes tipados, expiração e decisão; aprovar ou rejeitar usa as actions existentes, sem edição ou pacote nesta entrega. Aprovação é estado da ação no ERP, não recibo de entrega externa.

## Dados e autorização

SugestaoAriaThread vem do painel atual do atendimento, sem consulta por cartão ou payload bruto. O cliente não repete a autorização: cartoes já são filtrados por alvo da ação/fallback, enquanto podeDecidir refere-se ao lead do atendimento. Por isso cartoes autorizados não são escondidos por podeDecidir=false. O servidor revalida ator/escopo e estado ao decidir. As alçadas atuais são Admin/GC; D1 aprovada (responsável da CONVERSA) e D2 aprovada (edição/humano/pausa e pacote atômico) ficam nas #354–356.

InboxNovo repassa apenas painelDoAberto.aria. A troca de atendimento descarta a prop do painel anterior imediatamente; o callback atual aoMudar recarrega lista e painel após sucesso. PainelAria legado permanece até #353. Sem novos filtros, SSE, polling, compositor ou queries.

## Ordenação e apresentação

intercalarSugestoes recebe itens crus e sugestões e retorna uma cópia estável ordenada por instante. No empate os itens existentes precedem a sugestão; instantes nulos ficam por último. A sugestão anterior ao inicioJanela aparece no topo quando pendente e é omitida quando decidida. inicioJanela nulo admite todas as fornecidas; o cursor continua exclusivo das mensagens. Comparação usa epoch, inclusive offsets.

O fio real já contém mensagens e notas; não se antecipa intercalarFio/330, tarefas ou agendadas. A nova variante temporal é intercalada ANTES de decorarThread: recebe o dia correto, interrompe sequências de balões e usa key sugestao-aria:id, mantendo keys/cursores das mensagens e notas. Decoração sem sugestões preserva o legado. VirtualList continua com seu núcleo/ancoragem/stableMount; só o consumidor inclui a nova variante entre as linhas com foco. Busca continua lendo mensagens.

visualSugestao é pura: textos da issue para enviar/documento, agendar, etapa, tarefa, tag, campo, perdido, nota, condição e outro. ETAPA_LABEL e ACAO_AGENTE_IA_LABEL permanecem fontes de rótulos. Datas usam formatarInstanteExibicao no fuso explícito; decisão sem data não inventa relógio, e nome ausente não mostra ID. Texto é escapado pelo React, preservando quebras.

Cartão alinhado à direita em min(520px,80%), raio14, sem sombra, borda warning pendente/neutra decidida e tokens existentes nos dois temas. Botões do design system preservam alvo44 mobile e altura36 desktop pelo grupo. perigoContorno é uma variante opt-in de perigo; o classificador mantém conjunto fechado, ramos correlatos e recusa opacos/desconhecidos. Os dois rótulos dinâmicos têm registro exato e âncora AST na guarda, sem aria-label artificial.

## Ações e estado de tela

CartaoSugestaoAria usa useAcaoCliente({idempotente:true}), Botao e FeedbackAcao reais. Uma sessão por ID impede que ACK antigo execute callback em cartão/contexto novo. Trava síncrona bloqueia clique duplo e aprovar/rejeitar simultâneos. Sucesso chama aoDecidir uma vez quando ainda montado. Ao receber decisão no mesmo cartão, a propriedade do foco é capturada antes de desabilitar e no detach estável do grupo antes da remoção; o resultado conectado recebe foco somente se o disparador foi perdido e não há um novo foco externo. A região role=status permanece montada vazia antes do texto de decisão, inclusive para SSE sem nosso ACK. Não há foco genérico em toda recarga. Erro de negócio/expiração mostra a mensagem com foco e não chama o callback. Falha de transporte apresenta resultado incerto; não há retry automático nem status otimista. Retry manual continua validado pela #349.

Pendente envia/documento tem aviso explícito de envio irreversível; agendar usa Agendar/Ignorar; demais Aprovar/Rejeitar. Decidida não tem botões. Sem Editar, Editar tarefa, Desfazer ou nova ação de negócio.

## Verificação e limites

TDD cobre projeção, fronteira temporal, decorator legado, botões/classificador, ReactDOM/executor/feedback e composição. O DOM mínimo só simula glifos SVG no teste de interação; não é prova de layout, teclado nativo ou rede. Gates nominais/negativos constam no relatório. TSC coordenado, aceite visual de seis pares, interações nativas, QA independente e integração/CI ainda pendentes neste checkpoint.

Aceite visual obrigatório: 1440x900,1024x768,390x844 em claro/escuro, APP com resposta/tarefa pendentes e aprovado versus referência c1. Diferenças explícitas: base individual sem edição/pacote (extensões futuras aprovadas), expiração ERP e design system flat. Nenhuma imagem antiga é reatribuída. Fixture/providers/preview/captura e qualquer ação UI dependem de preparo/GO próprio do integrador. Nenhum envio real é autorizado pela apresentação do cartão.
