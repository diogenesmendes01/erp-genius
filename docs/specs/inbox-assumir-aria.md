# Assumir conversa da Aria — #357 / D3

## Contrato e fronteiras

A nova action `assumirConversaDaAria(atendimentoId)` atribui a conversa ao ator atual, pausa a Aria por MANUAL, cancela intenções IA PENDENTE/ADIADA e rejeita sugestões SUGERIDA com motivo auditável. A action antiga `assumirAtendimento`, o helper global de pausa e os demais fluxos legados conservam seus contratos. Não implementa #358 (bloqueio do compositor), #355 (editar/aprovar) ou política global nova.

O DTO obrigatório `AriaDoAtendimento.podeAssumirAria` e a mutação usam `contextoAssumirAria`: atendimento individual visível para envio, destino atual válido, número ativo, contato sem opt-out, atendimento aberto, fila autorizada ou mesmo responsável. Carteira e capacidade geral de decidir cartões não substituem essa autorização. Outros responsáveis e grupos não recebem a nova alçada; consumidores fora de contexto Aria mantêm a action legada.

## Transação e concorrência

A TX trava TODAS as ações SUGERIDA do atendimento em id ASC, depois Atendimento FOR NO KEY UPDATE. Revalida ator ativo/ACL/linha/destinatário/responsabilidade, pertencimento e status das ações. Uma sugestão nova observada após adquirir o pai causa rollback integral e retry de TX até3 vezes, exclusivamente para sentinel privado; o esgotamento retorna erro claro. Não há lock tardio de ação, advisory, skip-locked, bypass ou retry de40P01/P2034.

O fluxo específico exige MANUAL mesmo após HANDOFF/CELULAR/HUMANO_RESPONDEU, conserva o histórico e registra pausa e AtendimentoAssumido. Intenções ENVIANDO, humanas e de outra conversa permanecem intactas. Uma chamada repetida só não escreve se último evento de posse for Assumido do mesmo ator, com recibo desta operação e a mesma pausa MANUAL vigente; devolver/reativar/reassignment invalidam o recibo.

Depois de esperas por cancelamento de intenções, revalida o ator e o contexto novamente; qualquer falha desfaz pausa, cancelamentos, rejeições, atribuição e eventos. Toda cadeia recebe a mesma TX, inclusive no pool1. O lock inicial NO KEY UPDATE permite FK KEY SHARE do criarTarefa global331; os locks do executor/CRM global não foram alterados.

## Interface e foco

Cabeçalho e AbaOportunidades usam a action nova somente no contexto Aria e reconciliam após ACK da geração atual, sem autofocus. Identidade A→B→A, revogação/reconcessão de capacidade, unmount e handler retido não autorizam efeitos do ACK antigo.

ModalResumoHandoff usa o Modal/hook canônicos. O responsável atual também confirma MANUAL antes de Responder. Para esse CTA, leitura503/pendente ou envio revogado bloqueiam a ação. Retry anterior ao ACK somente solicita a leitura existente: não substitui a ação MANUAL. O foco local ocorre apenas após ACK atual, painel200 posterior, responsável e capacidade de envio vigentes. Snapshot é somente leitura;503 conserva resumo/retry e404 revoga capacidades sem apagar histórico. Sem selector global, remount da conversa/rascunhos, envio automático, polling ou fetch paralelo.

## Verificação e aceite pendente

Evidências detalhadas, sessões e negativos ficam em output/inbox-357-report.md. Integração usa perfil ci-integracao492 original e sete providers vazios no executor. Driver fake é fronteira explícita do teste de ENVIANDO, sem rede externa.

A entrega DEV não presume homologação: QA independente, TypeScript e gates globais originais na composição de publicação, build e visual continuam sujeitos à coordenação ROOT. Não alterar a issue para concluída com aceite visual pendente.

## R2 — SSE próprio antes do ACK (#357 P2)

Uma tentativa local é registrada na abertura atual antes de chamar a action. Se um GET 200 do próprio SSE antecipar o ACK e trouxer handoff nulo, mesmo atendimento, responsável atual e capacidades compatíveis, o resumo permanece somente como recibo de leitura. Isso não habilita outra mutação, não simula ACK e não autoriza foco. O ciclo do Modal preserva somente o callback já iniciado; iniciar continua exigindo contextoAtivo e o executor canônico mantém a trava de duplo clique.

O ACK válido sempre pede uma aquisição nova: o mínimo é a sequência solicitada no instante do ACK mais um. GET já solicitado antes dele, mesmo terminando depois, não basta. Somente a leitura posterior 200 vigente, responsável atual, envio e capacidade válidos concluem a intenção e selecionam/focam Responder localmente. O campo físico e os rascunhos permanecem.

404, perda de capacidade, responsável diferente, desatribuição depois de posse própria observada e revogação de envio invalidam o recibo; reconcessão posterior não revive a intenção antiga. Responsável ainda nulo antes de qualquer posse própria confirmada conserva o resumo e permite tentar apenas a leitura, sem foco. Fechar/reabrir, trocar A→B→A ou desmontar também criam fronteira de geração. Erro de negócio/transporte preserva o resumo sem fabricar sucesso.

Esta correção é somente UI. Backend, DTO, idempotência da action, configuração e dependências permanecem literais à fonte 07312678. SQL não foi repetida. QA R2 em docs/qa/inbox-357-r2-sse-antes-ack.md; gates originais e parecer independente continuam com o ROOT.