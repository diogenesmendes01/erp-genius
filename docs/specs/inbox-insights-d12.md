# Inbox — Insights D12 (#377)

Estado: fase pura em implementação; aba, geração real e persistência ainda não entregues.

D12 aprova análise completa por IA sob demanda pelo botão Atualizar, data da geração e indicação de novas mensagens não analisadas. Rascunhos e Escrever com Aria consomem exatamente o mesmo texto sugerido persistido. A audiência é COMERCIAL + veLead contextual, como #334, sem permissão global nova. Responder e demais escritas continuam sujeitos a D3/D11/Assumir.

## Contratos puros aprovados

A análise contém temperatura estimada, chance de fechar, sentimento, melhor horário, intenção, sinais de compra, objeções/riscos, próximo melhor passo e texto sugerido. Falta de evidência produz null/listas vazias. Não altera temperatura ou resumo manual do CRM e não representa entrega externa.

O schema local rejeita campos extras, enum desconhecido, chance fora0..100/não finita, texto vazio, mais8 itens, texto curto acima500 e sugestão acima4000. JSON com markdown/prefixo não é reparado. A sugestão é preservada exatamente, sem gerar uma segunda variante por destino.

Contexto puro recebe apenas mensagens do atendimento previamente autorizado. Seleciona até30 mais recentes, por criadoEm/id; exclui apagadas/sem texto e saídas que não chegaram a ENVIADA/ENTREGUE/LIDA. Aplica porta obrigatória de mascaramento, até2000 caracteres por fala e24000 no conjunto, priorizando as mais recentes. Hash inclui conteúdo/edição e identidade interna da base; receipt de entrega sozinho não muda hash. IDs/hash não entram no pedido do modelo. A porta não equivale anonimização perfeita.

Pedido usa factory existente, tarefa resumo, maxTokens2048 e saída estruturada fechada. Mensagens/referências/configuração publicada são dados serializados, não instruções com autoridade para alterar regras. Campos de CRM são projetados por lista fechada. Nenhum provider é chamado nesta fase.

DTO projeta apenas última análise validada/data ISO/simulação/base desatualizada e estado. Preserva análise anterior durante geração. INCERTO bloqueia Atualizar e permite descarte explícito pela mesma capacidade; erro de cache não vira análise fabricada. O produtor deverá autorizar antes da consulta; a projeção pura não substitui essa ACL.

## Próximas fases e limites

Modelo GeracaoInsightInbox e migração futura493 reservados pelo ROOT, ainda não escritos/aplicados. Claim durável, finalização, custo conhecido mesmo com publicação recusada, estado INCERTO/DESCARTADA e índice ativo dependem da revisão técnica do contrato antes de Prisma. Provider fora TX; nenhuma repetição automática de geração. Fechar UI não promete cancelar gasto. Simulado só demo identificada, produção sem provider indisponível.

Bridge Compositor/scheduler depende da composição358 e coordenação ROOT/B. Texto existente exige confirmação canônica antes de substituir, mantendo componente físico/rascunho e ACK/GET fresco do Assumir. Aba Insights só será habilitada com conteúdo e produtor completos. Sem schema/SQL/API real/credenciais/build nesta fase.
