# Inbox E0.2 — Leitura automática da conversa (#299)

Estado: em implementação em 22/10/2026; homologação e verificações finais pendentes.

## Problema

Abrir uma conversa no Inbox não registra a leitura. O indicador pessoal usa `PreferenciaConversaUsuario.lidaAte`, enquanto o atendimento guarda o contador compartilhado `naoLidas`. O WhatsApp também precisa receber `message.read` quando o motor do número estiver conectado.

## Contrato funcional

- Ao abrir um atendimento visível, inclusive por `/inbox?c=<id>`, o servidor marca `lidaAte` do usuário, limpa `marcadaNaoLida` e zera `AtendimentoWhatsApp.naoLidas`.
- A lista mostra zero imediatamente para o atendimento aberto; a consulta seguinte confirma o valor persistido.
- Uma consulta iniciada antes da abertura ou durante a leitura não pode repor contagem antiga na conversa aberta, mesmo que termine após a confirmação. Consulta iniciada após a confirmação pode mostrar uma contagem nova. Se a ação falhar, a lista restaura a última contagem conhecida e faz uma consulta de reconciliação, sem repetição automática.
- Após uma falha, consultas de outra versão de leitura não substituem a contagem restaurada. Um GET da mesma versão, sem entrada posterior, pode corrigi-la mesmo que a ação falhe enquanto a consulta está em voo.
- Uma nova mensagem da conversa aberta repete a leitura somente quando a aba está visível. Mensagens de outra conversa, avisos de outros tipos e aba oculta não disparam leitura.
- PR382/B1: a região real da thread também precisa estar exibida no DOM. Voltar para a lista ou ocupar a vista com o painel no celular impede a leitura e preserva o novo contador, mesmo que a seleção continue guardada. A visibilidade vem de `getClientRects`, sem repetir breakpoints do CSS. Em duas colunas, a thread que continua visível mantém a leitura normal.
- Uma repetição enfileirada só é executada se a mesma conversa e a aba ainda estiverem visíveis. A leitura já enviada ao servidor não é cancelada. Ao reabrir a mesma conversa, ocorre uma nova leitura normal.
- PR382/C1: o evento `visibilitychange` marca a conversa selecionada ao retornar à aba visível, somente se a região da thread estiver exibida e houver contagem positiva ou entrada ainda pendente de confirmação. Uma conversa já lida não dispara outra ação por alternar abas. As entradas ficam identificadas por mensagem, inclusive quando uma leitura visível é enfileirada e suspensa ao ocultar a aba. Somente o sucesso consome as observadas no início daquele pedido; entradas posteriores permitem nova tentativa no próximo retorno. Esse marcador é independente do contador. O listener é removido ao desmontar.
- PR382/C2: a ação composta invalida `/inbox` uma única vez. O sucesso compartilhado já invalida a rota; se a parte compartilhada falhar depois de gravar a preferência pessoal, a invalidação pessoal é mantida. A ação pessoal isolada continua invalidando uma vez. Falha de escopo não grava nem invalida.
- Cada entrada oculta única acrescenta uma unidade à contagem já conhecida.
  O início de cada GET captura a época dessas entradas. Uma resposta iniciada
  antes de nova entrada não reduz o mínimo posterior; um GET iniciado depois
  dos avisos, na mesma versão de leitura e sem entrada posterior, corrige a
  contagem pelo snapshot fresco, inclusive zero: outra aba pode ter lido a
  conversa. Isso também corrige SSE atrasado de mensagem já incluída no
  snapshot. IDs sem confirmação não impõem mínimo ao contador. A conclusão
  bem-sucedida reduz a contagem às entradas posteriores ao pedido, sem elevar
  um zero fresco pela existência de IDs ainda pendentes.
- Pedidos simultâneos da mesma conversa são consolidados; se outro pedido chegar durante um envio em voo, uma única repetição ocorre ao terminar. Conversas distintas podem seguir em paralelo.
- Fora do escopo, a ação devolve erro e não grava preferências nem altera contador. A confirmação ao WhatsApp exige recurso `confirmacaoLeitura`, disponível apenas com número ativo, driver compatível e sessão `CONECTADO`. Falha do motor não desfaz a leitura local.
- A leitura pessoal é uma preferência operacional; esta correção não adiciona evento, migration, polling nem envio de mensagem ao contato.

## Aceite

Testes unitários da tela e da consolidação; integração de preferência, contador compartilhado, escopo e presença do motor com banco descartável; TypeScript e lint com saída 0. Conferir visualmente o desaparecimento do contador ao abrir em 1440×900, 1024×768 e 390×844, claro e escuro. Registrar filtros, testes ignorados e evidências no quadro de entregas antes de considerar a issue concluída.

Referências: [funções oficiais do Inbox](../planejamento/funcoes-do-inbox.md), [quadro único](../planejamento/quadro-entregas.md), issue #299.

## Experimento de leitura automática sem revalidar a árvore

Follow-up técnico da integração313, sujeito a A/B de navegação rápida. marcarConversaLida e marcarAtendimentoLido manuais continuam invalidando exatamente uma vez, incluindo fallback pessoal em falha compartilhada; marcarLida isolada também permanece. Os novos wrappers automáticos fixam internamente revalidar=false e não recebem essa opção do cliente. As mesmas verificações de sessão/escopo e escritas operacionais são compartilhadas. Inbox automático conserva GET lista/chips, selo finally e proteçõesR6; nenhum transporte ou política de autorização mudou. Integração dirigida2arquivos20testes e unitáriosdirigidos aprovados, mas a experiência do browser/global ainda não autoriza adoção definitiva. Relatóriooutput/inbox-313-report.md.
