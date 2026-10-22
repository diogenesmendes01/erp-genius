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
- Pedidos simultâneos da mesma conversa são consolidados; se outro pedido chegar durante um envio em voo, uma única repetição ocorre ao terminar. Conversas distintas podem seguir em paralelo.
- Fora do escopo, a ação devolve erro e não grava preferências nem altera contador. A confirmação ao WhatsApp exige recurso `confirmacaoLeitura`, disponível apenas com número ativo, driver compatível e sessão `CONECTADO`. Falha do motor não desfaz a leitura local.
- A leitura pessoal é uma preferência operacional; esta correção não adiciona evento, migration, polling nem envio de mensagem ao contato.

## Aceite

Testes unitários da tela e da consolidação; integração de preferência, contador compartilhado, escopo e presença do motor com banco descartável; TypeScript e lint com saída 0. Conferir visualmente o desaparecimento do contador ao abrir em 1440×900, 1024×768 e 390×844, claro e escuro. Registrar filtros, testes ignorados e evidências no quadro de entregas antes de considerar a issue concluída.

Referências: [funções oficiais do Inbox](../planejamento/funcoes-do-inbox.md), [quadro único](../planejamento/quadro-entregas.md), issue #299.
