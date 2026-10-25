# Inbox #347 — faixa de situação da Aria

A faixa consome somente SituacaoAriaInbox e as contagens ia/aprovacao/handoff do resumo autorizado da primeira página. #346 é dependência técnica do consumidor fresco; #344 é o produtor dos dados. Sem query, EventSource, polling, configuração ou ação global nova.

| Situação | Título | Linha de apoio |
|---|---|---|
| ATIVA sem pausa | Aria ativa | N em atendimento · M aguardando você |
| ATIVA pausada | Aria pausada | Pausada · novas conversas vão para a equipe |
| SHADOW | Aria em ensaio | Simula respostas sem falar com os contatos |
| DESLIGADA | Não renderiza | Não renderiza |

N é contagens.ia; M é aprovacao + handoff, nunca tamanho de página. Ambos números usam font-mono/tabular-nums. O estado SHADOW tem texto de ensaio mesmo se pausada for true; DESLIGADA sempre retorna null. Gerenciar é link de navegação para /aria, presente exclusivamente quando podeGerenciar é true no resumo recebido. Não inferir capacidade de papel no cliente.

D4 aprovada será entregue pela #359. A #347 não apresenta interruptor, role=switch, botão para pausar ou chamada à ação global. O ícone é decorativo. Textos de estado são anunciados por role=status; o link fica fora dessa região e conserva identidade enquanto permanece renderizado durante recargas de status/contagens. Não há foco automático na recarga.

O InboxNovo compõe o slot faixaAria já oferecido pela coluna e usa o MESMO estado resumo da #346, com suas barreiras de navegação, leitura e respostas antigas. Sem resumo não há faixa. SSR, tokens, detalhes325, fonte SSE345, compositor e backend permanecem com seus contratos atuais. A329 altera outro slot, sem cópia integral dos arquivos.

Validação nominal será registrada em output/inbox-347-report.md. Visual nas três larguras e nos dois temas, QA independente, TypeScript/global/CI e publicação permanecem pendentes até evidências próprias; este contrato não constitui homologação.
