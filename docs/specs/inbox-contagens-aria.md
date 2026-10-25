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
