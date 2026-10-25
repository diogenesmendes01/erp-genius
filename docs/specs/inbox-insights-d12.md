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

Modelo GeracaoInsightInbox e migração493 foram escritos pelo DEV e validados/aplicados pelo integrador somente no banco A. O kernel e sua integração funcional ainda estão pendentes. Claim durável, finalização, custo conhecido mesmo com publicação recusada, estado INCERTO/DESCARTADA e índice ativo dependem da revisão técnica do contrato antes de Prisma. Provider fora TX; nenhuma repetição automática de geração. Fechar UI não promete cancelar gasto. Simulado só demo identificada, produção sem provider indisponível.

Bridge Compositor/scheduler depende da composição358 e coordenação ROOT/B. Texto existente exige confirmação canônica antes de substituir, mantendo componente físico/rascunho e ACK/GET fresco do Assumir. Aba Insights só será habilitada com conteúdo e produtor completos. Nenhuma API real, credencial, build ou SQL funcional do kernel foi executado pelo DEV nesta fase.

## Apresentação e portas locais

O painel isolado mostra os nove campos da análise, data em fuso explícito, aviso de mensagens novas/contexto alterado e identificação de demonstração. Chance de fechar tem valor textual e semântica de meter. Sentimento usa mapa central nominal; temperatura reutiliza o mapa existente. Texto de modelo é escapado por React. Vazio usa EstadoVazio compacto e a região MensagemStatus permanece montada.

O hook de geração recebe uma porta injetada. Não há geração na montagem, SSR ou SSE. Clique explícito cria a intenção, o executor canônico impede clique duplo e o ACK solicita leitura posterior mesmo após SSE próprio. Troca de conversa, Pessoa, capacidade ou abertura e unmount invalidam o ACK antigo. Falha de transporte conserva resultado incerto local, sem retry automático.

Uso de sugestão recebe outra porta local, sem acesso ao campo físico. Se já há texto, ConfirmarAcao real exige confirmação antes de substituir; cancelar não chama a porta. O pedido carrega texto exato, geração e revisão esperada do rascunho. Token específico da confirmação impede reaproveitar handler antigo após cancelar/reabrir. Mudança de revisão, análise ou contexto invalida a confirmação. A bridge futura deverá conferir essa revisão antes de escrever, preservando anexos/menções e as regras de Assumir; os testes fake não substituem essa prova no consumidor real.

Continuam pendentes a ação/diálogo de descarte INCERTO com versão e chave persistidas, reconciliação após leitura fresca, produtor e aba reais, bridge e scheduler. Não existe botão CancelarPROCESSANDO. Esses elementos não foram simulados como entrega pronta.

## Infraestrutura e transporte opt-in

A migração 20261025200000_inbox_insights_d12 cria GeracaoInsightInbox, seis estados, versão CAS, referências históricas restritas e claim único ativo em PROCESSANDO/INCERTO. Autor, atendimento, configuração histórica e chamada não são apagados em cascata. Essa retenção é uma escolha deliberada; não se afirma a mesma política de purga anterior. baseUltimaMensagemId é referência opaca sem FK. OrigemChamadaIA ganha INSIGHT, rotulada como Insights.

O transporte aceita controle opcional com deadline total de até 30 segundos e nenhum retry. Esse caminho inclui o body, limpa timer/listener e classifica abort anterior ao POST separadamente de resultado possivelmente enviado. Nenhum controle entra no JSON. Chamadores sem controle mantêm argumentos, retorno, retries e implementação legada de chamarComRetry.

Somente o diagnóstico opt-in comprova as quatro contagens explícitas e o modelo observado. Ausência, valor parcial/inválido ou modelo fora dos nomes canônicos não são completados com zeros ou com o modelo pedido. Modelo canônico divergente também é incerto. Corpo inválido e recusa preservam uso conhecido. O envelope local não usa campos legados que receberam defaults.

Preços são capturados da tabela canônica no claim, incluindo faixa longa e fator de escrita de cache. A finalização calcula sobre esse snapshot, sem consultar configuração ou preços atuais. Uso/modelo não calculáveis retornam ausência de registro, não uma chamada de custo zero. Só a demonstração explicitamente simulada aceita custo conhecido zero com modelo/provedor simulados e contagens zero.

Esses contratos estão testados com HTTP fake e funções puras. Claim, início, finalização transacional, reconciliação, descarte, avisos e integração real do provider ainda dependem do kernel e de provas SQL nativas; não estão homologados por estes testes.

## Checkpoint do kernel privado (sem homologação SQL)

Claim usa ConfigIA SHARE → AgenteIA SHARE → Atendimento NO KEY UPDATE → geração. START relê orçamento global atual sem upsert, mantém modelo/configuração/preços históricos e congela as mensagens efetivamente enviadas na mesma marca CAS. Ausência de Config ou orçamento estourado antes da marca termina FALHOU, sem chamada fictícia. RETOMAR é explícito, do autor original e com id/versão/hash atuais, sem devolver a chave antiga. Pré-start inválido pode ser recusado antes de nova intenção, sem reatribuir autor/contexto; iniciado e INCERTO nunca sofrem limpeza automática.

Finalização trava Atendimento → geração e contabiliza uso conhecido no mesmo commit, mesmo quando ACL/binding impedem publicação. INCERTO/DESCARTADA aceitam somente contabilização tardia, sem publicar/reviver. Reconciliação e descarte usam ator atual realmente autorizado, hash atual esperado, versão CAS e Evento com chave operacional nova; não precisam expor chave/autor/contexto antigo. Replays exatos não geram Evento/aviso.

O orquestrador privado chama o provider uma vez e tenta apenas persistência duas vezes com envelope/recebidoEm imutáveis. Duas falhas retornam statusPersistencia NAO_CONFIRMADA e estado conhecido ANTES da finalização, sem afirmar estado atual/custo salvo. GET autorizado por geração+atendimento resolve o terminal real; não dispara provider/mutação. Leitura RepeatableRead mantém a audiência e as consultas no mesmo snapshot; análise somente PRONTA e contexto atual compatível. Metadata operacional não inclui autor/chave/pointers/configuração/resultados antigos.

O código deste checkpoint tem testes puros/doubles e lint; invariantes de locks, rollback, concorrência, custo e NOTIFY ainda exigem testes PostgreSQL reais. Nenhum endpoint, aba ou bridge foi habilitado. A definição anterior de pendências do kernel passa a significar prova nativa/integração, não ausência de autoria do código.
