# Inbox #353 — Aria na conversa, sem painel legado

## Contrato final

A aba Detalhes não monta PainelAria. Pausa e motivo ficam na linha do cabeçalho; Devolver para Aria fica no slot de ação do cabeçalho, com feedback visível irmão. Sugestões pendentes e decisões recentes ficam nos cartões da thread. Handoff fica na faixa e no ModalResumoHandoff. As demais seções de Detalhes, as abas e seus campos continuam montados pelo mesmo coordenador.

AriaDoAtendimento contém somente pausada, motivo, podeDevolver, podeDecidir, cartoes e handoff. O campo legado sugestoes, resumoDaSugestao/RESUMO_MAX e sua aquisição paralela de candidatas foram removidos. Não há migração, endpoint novo, mudança de schema ou capacidade nova. O helper textoPausaAria permanece em aria/textos-aria; apenas seu reexport pelo arquivo removido deixa de existir.

cartoesDaThread mantém literalmente seus escopos por lead, limite de vinte autorizadas, keyset/ordem e decisões das últimas24h. handoffDoAtendimento mantém literalmente o limite de dez ações autorizadas, redação pública, dados e capacidades. podeDecidir e podeDevolver continuam usando as mesmas regras do servidor. A ausência do DTO fora do escopo e o 404 que limpa capacidades copiadas continuam iguais; 503 mantém o último dado e não autoriza foco pelo snapshot.

## Ações e identidades preservadas

CartaoSugestaoAria continua chamando as actions aprovarAcaoAria/rejeitarAcaoAria existentes, seguido de aoDecidir=aoMudar somente no sucesso atual. ControladorDevolverAria continua usando devolverParaAria, com token de ciclo e aoMudar atuais; o cabeçalho recebe seu botão e o feedback fica fora do header. ConversaAberta repassa aoMudar ao InboxNovo.recarregarLista, que atualiza a lista e a revisão do painel existente. Não foi criado fetch, polling, SSE ou controlador de autorização paralelo.

Os componentes novos348/350/352, actions, compositor, rascunhos e Modal/useDialogo permanecem literais à base8535c5ba. AcoesContato conserva key por atendimento e identidade na atualização SSE; trocar atendimento troca sua identidade, sem duplicar montagem. As guardas de edição/formulário e o recibo de painel352 continuam preservados. A retirada da identidade que pertencia ao PainelAria não remove as asserções sobre as subárvores remanescentes.

## Cobertura e limites

PainelAtendimento.aria.test testa ausência do arquivo/montagem legados, texto/dica de pausa, botão canônico de devolução, cartão pendente/decidido e identificação das mensagens IA. ConversaAberta.test verifica o cartão no consumidor VirtualList real e o vínculo do callback atual; InboxNovo.interacao.test verifica ausência do bloco e que o mesmo callback atualiza lista e painel. Os testes reais existentes de aprovar/rejeitar/devolver e handoff continuam na regressão da pasta, preservando ACK antigo, foco, erro/transporte e rascunhos.

consultas-inbox.aria.int.test passa a exigir ausência de sugestoes e as seis chaves canônicas. Casos de pendência comparam cartoes filtrados por status SUGERIDA; isso não elimina os casos próprios de histórico aprovado/rejeitado/expirado nas últimas24h. Permanecem cobertura de vigência/null-expira, gerente somente da equipe, Admin, atendimento sem lead, vendedor sem decisão pela política atual, fora do escopo, pausa/devolução, vinte autorizadas após201 negadas, desempate ASC e transação pool1. As igualdades do painel dos setores usam o mesmo DTO canônico.

O report registra RED/GREEN, comandos/recortes, sessões e pendências. Gates originais globais, build/CI, QA independente e aceite visual são separados do integrador. Visual previsto:1440×900,1024×768 e390×844, claro/escuro; Detalhes sem duplicação, pausa/devolver no cabeçalho, cartões/handoff preservados, sem negócio externo.

D1–D4 já têm aprovação humana em inbox-decisoes-produto.md; aprovação não é implantação. #353 não amplia quem pode decidir, não implementa pacote/edição, MANUAL/bloqueio/cancelamento de sugestões da #357 ou interruptor global. Não declarar a E3 inteira concluída por remover o painel.

### Gates DEV da remoção

RED de consumidor73bba1 EXIT1:112 casos/duas falhas; RED de contrato INT91605/9b8f5f EXIT1:13 casos/quatro falhas. UNIT recorte81247/2ce618 EXIT0:86 arquivos/1.024 testes. INT60306/31a78a EXIT0:55 arquivos/699 testes, configuração original e banco descartável ci-integracao reservado, uma suíte por vez. Lint10 572c9b EXIT0. Limpeza do wrapper órfão após a integração passou no focal5 arquivos/158 casos6430fe e lint7e4432 EXIT0. Não é suíte global, nem aceite visual; relatório contém comandos, negativos e limites. Lease devolvida ao integrador após terminal, sem servidor/build/PR/push.
