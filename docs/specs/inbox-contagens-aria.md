# Inbox #344 — filtro Aria e contagens: contrato em construção

A #344 depende de #342/#343. O objetivo completo inclui filtro de EstadoAria antes da paginação e sete contagens em um agregado SQL, mantendo os cinco chips legados até #346/#347. Esses consumidores e consultas ainda não foram alterados nesta entrega.

## Marco 1: tradutor fechado

whereAtendimentoEmSql recebe exclusivamente um Prisma.AtendimentoWhatsAppWhereInput e produz Prisma.Sql sobre o alias interno a. É uma tradução de formatos, sem consulta DB ou decisão de papéis. A autorização continua vindo de escopoAtendimentos; esse predicado deve ser combinado pelo futuro consumidor. A função isolada não autoriza acesso.

O registry privado enumera somente as tabelas, relações e campos necessários à ACL e aos filtros atuais: atendimento, conversa, número/setores, contato/responsável, Lead, aluno, participantes e preferências. Oportunidade conserva o nome físico Lead. Campos, relações e operações desconhecidos são recusados, inclusive chaves de protótipo; não se transformam em TRUE nem desaparecem. Operadores fora desse subconjunto, como every, isNot, notIn e startsWith, permanecem recusados até prova e implementação explícitas. Não é um conversor geral de WhereInput.

Valores são parametrizados. Nomes de tabelas/colunas, aliases, operações e casts vêm somente do registry fechado. Datas são ISO UTC com cast timestamp(3); tipos e enum são validados. some/none e relações singulares usam EXISTS correlacionado, mantendo uma linha por atendimento. Relação opcional nula usa a FK nula. Não há join de coleção, queryRawUnsafe, varredura de IDs globais, limite artificial de candidatos ou consulta por item. Conjuntos de contexto produzidos pelos helpers canônicos, como titulares/equipe e pares docente-aluno, são preservados sem cap.

A busca reutiliza whereBuscaConversas: palavras, nomes autorizados, dígitos e condicionais de setor conservam o formato atual. LIKE/ILIKE preservam a interpretação de curingas e barra do Prisma, sem substituir por busca literal ou concatenar valores na SQL.

## Normalização e paridade

A normalização segue os oráculos reais do Prisma instalado. OR:[] no topo não casa linhas; grupos estruturalmente vazios dentro dos conectivos são podados. Por exemplo, AND:[{}, {OR:[]}] é vazio no Prisma e não deve virar FALSE. Não se presume uma truth-table genérica a partir de um caso isolado. Todo filho é validado antes da poda, para que um filtro desconhecido nunca seja autorizado como vazio.

O corpus compara os IDs de SELECT SQL com findMany Prisma usando o MESMO where canônico no mesmo Db. Cobre leitura/envio, todas as vias atuais de ACL, NULL/NOT/relações, lógicos vazios e mistos, busca, limites de convite/revogação, carteira e posse de linha independentes, docente, contexto com membro301, pool1/rollback e três TZ da mesma conexão. As guardas pedagógicas/financeiras continuam ativas nas fixtures.

## Marcos posteriores, ainda pendentes

O agregado novo terá base que retira aria e prazoEstourado e retira responsável somente quando fila; preserva eu/ID e não lidas. FINANCEIRO para Admin no cenário A–G conta 1, conforme decisão ROOT, sem mudar ACL. Os cinco chips legados continuam com sua própria base e API. A expressão SQL de EstadoAria deve ser equivalente ao produtor #342 e os filtros devem preceder keyset/limites. Esses marcos exigem novo GO após revisão do tradutor.

Nenhuma nova alçada D1–D3, interruptor D4, edição da ACL, migração, dependência ou interface entrou no marco 1. Lista, rota, página e InboxNovo permanecem preservados. Gates e negativos nominais estão no relatório; esta SPEC parcial não conclui #344.

## Marco 2 — expressão de estado e agregado, 24/10/2026

Marco 1 aprovado pelo ROOT após QA independente. O marco 2 acrescenta estado-aria-sql e contagens, ainda sem importar esses módulos na lista/rota/página/InboxNovo. A API dos cinco chips legados e o parser da URL continuam intactos. O marco 3 ainda exige revisão e GO.

estadoAriaEmSql usa aliases internos a/c/n/ct e a mesma prioridade do produtor #342: encerrado/grupo → null; handoff pendente → handoff; pausa → humano; sugestão vigente → aprovacao; global efetivo e elegibilidade → ia; responsável → humano; demais → null. H e S são EXISTS correlacionados, sem lista de IDs. Estados retornados, ativação e instante são bindings; Date usa ISO UTC com timestamp(3). Junções são apenas singulares, sem multiplicação por mensagens, Eventos ou sugestões.

carregarContextoListaInbox(db,u,agora,enviar) carrega situação, orçamento e escopo canônico uma vez e devolve ContextoListaInbox interno reutilizável. Não chama carregarContextoAria sem IDs e não busca H global. Reutiliza ariaAtivaGlobal, situacaoAria, estadoOrcamento e capacidadesAria. O único bootstrap é o upsert legado de ConfigIA já existente no orçamento; não se promete leitura sem escrita. Todo loader usa o Db recebido, inclusive em pool1. O contexto não é recebido do HTTP nem serializado como DTO.

resumoComContexto executa UM agregado com sete COUNT FILTER e uma linha por atendimento. resumoDaListaInbox conserva (u,f,agora?) e admite opções internas aditivas db/enviar. A base retira aria, prazoEstourado e responsável somente quando fila; mantém eu/ID, não lidas, setor, número, status e busca. Não lidas usa a fórmula pessoal canônica em EXISTS correlacionado, sem comLeitura global. Fila é responsável nulo e encerradoEm nulo; SLA usa prazo estritamente anterior, primeira resposta nula e encerramento nulo. todas preserva linhas de estado null e filtros de status. Chips se sobrepõem e não formam uma partição.

O DTO novo tem contagens {todas,ia,aprovacao,handoff,humano,semResposta,naoAtribuidas} e aria {estado,pausada,podeGerenciar}. A faixa conserva o estado bruto da política e pausa; orçamento/versão compõem somente o global efetivo usado na classificação. podeGerenciar vem de pausar, sem conceder ação. COUNT bigint é validado como não negativo e até Number.MAX_SAFE_INTEGER antes de converter; tipo inesperado/overflow não vira zero nem int32.

A consulta de sete totais é única; loaders de situação/orçamento/ACL têm custos separados. Não se chama toda a requisição de uma consulta. O instante é compartilhado por estado, SLA e convite; o helper canônico da carteira mantém seu relógio/contrato existente. Mesmo Db não significa snapshot serializável universal em READ COMMITTED. O contexto evita cargas duplicadas quando reaproveitado, sem antecipar locks ou alçadas D1–D3.

Paridade real cobre derivação/condições #342, H/S/CASE, T−1/T/T+1, três TZ da mesma conexão, NULL, envio, não lidas pessoais, contexto não commitado/pool1/rollback e mais de 300 handoffs. O caso de grupo executa SELECT sintético e não grava atendimento proibido pelo trigger. No cenário A–G, FINANCEIRO para Admin conta 1. Integração na lista antes da paginação, SSR/API e apresentação continuam pendentes.
