# Inbox E0.2 — Leitura automática da conversa (#299)

Estado: em implementação em 22/10/2026; homologação e verificações finais pendentes.

## Problema

Abrir uma conversa no Inbox não registra a leitura. O indicador pessoal usa `PreferenciaConversaUsuario.lidaAte`, enquanto o atendimento guarda o contador compartilhado `naoLidas`. O WhatsApp também precisa receber `message.read` quando o motor do número estiver conectado.

## Contrato funcional

- Ao abrir um atendimento visível, inclusive por `/inbox?c=<id>`, o servidor marca `lidaAte` do usuário, limpa `marcadaNaoLida` e zera `AtendimentoWhatsApp.naoLidas`.
- A lista mostra zero imediatamente para o atendimento aberto; a consulta seguinte confirma o valor persistido.
- Uma consulta iniciada antes da abertura ou durante a leitura não pode repor contagem antiga na conversa aberta, mesmo que termine após a confirmação. Consulta iniciada após a confirmação pode mostrar uma contagem nova. Se a ação falhar, a lista restaura a última contagem conhecida e faz uma consulta de reconciliação, sem repetição automática.
- Após uma falha, respostas de consultas iniciadas antes dela não substituem a contagem restaurada. Uma consulta iniciada já na fase de falha pode corrigir essa contagem com o valor atual do servidor.
- Uma nova mensagem da conversa aberta repete a leitura somente quando a aba está visível. Mensagens de outra conversa, avisos de outros tipos e aba oculta não disparam leitura.
- PR382/B1: a região real da thread também precisa estar exibida no DOM. Voltar para a lista ou ocupar a vista com o painel no celular impede a leitura e preserva o novo contador, mesmo que a seleção continue guardada. A visibilidade vem de `getClientRects`, sem repetir breakpoints do CSS. Em duas colunas, a thread que continua visível mantém a leitura normal.
- Uma repetição enfileirada só é executada se a mesma conversa e a aba ainda estiverem visíveis. A leitura já enviada ao servidor não é cancelada. Ao reabrir a mesma conversa, ocorre uma nova leitura normal.
- PR382/C1: o evento `visibilitychange` marca a conversa selecionada ao retornar à aba visível, somente se a região da thread estiver exibida e houver contagem positiva ou entrada recebida enquanto ela estava oculta. Uma conversa já lida não dispara outra ação por alternar abas. A entrada oculta permanece pendente mesmo se um GET ainda trouxer zero ou uma leitura anterior terminar; a próxima leitura consome esse sinal. O listener é removido ao desmontar.
- PR382/C2: a ação composta invalida `/inbox` uma única vez. O sucesso compartilhado já invalida a rota; se a parte compartilhada falhar depois de gravar a preferência pessoal, a invalidação pessoal é mantida. A ação pessoal isolada continua invalidando uma vez. Falha de escopo não grava nem invalida.
- Pedidos simultâneos da mesma conversa são consolidados; se outro pedido chegar durante um envio em voo, uma única repetição ocorre ao terminar. Conversas distintas podem seguir em paralelo.
- Fora do escopo, a ação devolve erro e não grava preferências nem altera contador. A confirmação ao WhatsApp exige recurso `confirmacaoLeitura`, disponível apenas com número ativo, driver compatível e sessão `CONECTADO`. Falha do motor não desfaz a leitura local.
- A leitura pessoal é uma preferência operacional; esta correção não adiciona evento, migration, polling nem envio de mensagem ao contato.

## Aceite

Testes unitários da tela e da consolidação; integração de preferência, contador compartilhado, escopo e presença do motor com banco descartável; TypeScript e lint com saída 0. Conferir visualmente o desaparecimento do contador ao abrir em 1440×900, 1024×768 e 390×844, claro e escuro. Registrar filtros, testes ignorados e evidências no quadro de entregas antes de considerar a issue concluída.

Referências: [funções oficiais do Inbox](../planejamento/funcoes-do-inbox.md), [quadro único](../planejamento/quadro-entregas.md), issue #299.
