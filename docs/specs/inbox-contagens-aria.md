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
## Marco 3 — seleção, paginação e contrato aditivo (24/10/2026)

O GO do integrador conclui o produtor da #344 sem antecipar controles de #345–#347. `aria` aceita somente `ia`, `aprovacao`, `handoff` e `humano`; valores desconhecidos são ignorados pelo parser. A whitelist e o tipo foram extraídos literalmente para `estado-aria-valores.ts`, puro e sem import/efeito. `estado-aria.ts` reexporta os contratos antigos; suas sete funções permanecem idênticas. As duas serializações de URL preservam aria junto dos filtros existentes; os cinco chips continuam com sua API e suas próprias dimensões.

A seleção SQL combina o where canônico autorizado e filtros parametrizados antes do keyset e dos limites. Cursor textual é composição fechada separada; o registry do marco 1 continua recusando `id.lt`. Ordenação permanece ultimaMensagemEm DESC NULLS LAST/id DESC. Primeira página recebe até 100 fixadas e até 200 normais; páginas seguintes excluem TODAS as fixadas pessoais, inclusive as que ficaram além das primeiras 100. O cursor deriva da última linha normal selecionada. IDs selecionados não concedem acesso: a hidratação Prisma limitada à página reaplica ACL e filtros atuais, ordena pelos IDs selecionados e pode retirar linhas cujo acesso/estado mudou. Não promete snapshot transacional universal ou preenchimento de lacunas sob mudanças concorrentes.

Preferências pessoais são lidas em uma consulta do mesmo Db, exclusivamente para os IDs já hidratados/autorizados. Leitura depois de lidaAte, marca explícita, contador compartilhado, fixação e silêncio preservam os contratos anteriores. Instantes distintos não criam consultas por item ou por instante. Handoffs e sugestões usados na montagem também ficam limitados aos IDs autorizados da página; nenhum universo de IDs é carregado.

`OperacaoListaInbox` é interna e preguiçosa. Memoriza as promessas de escopo/global antes de qualquer await, inclusive em chamadas concorrentes. Compartilha Db, ator/papéis, instante e envio entre lista, deep link, chips e resumo. Não muda o where canônico ou filtro recebido. Situação/orçamento são carregados uma vez quando necessários; preserva somente o upsert legado de ConfigIA. Uma lista isolada sem aria/resumo e sem resultados retorna antes desses loaders. Pedido explícito de resumo, inclusive SSR vazio, autoriza a carga global.

Os cinco agregados legados removem responsável/nãoLidas/prazo de sua base e preservam aria e os outros filtros. O resumo novo mantém sua base M2: remove aria/prazo e responsável SOMENTE se fila, conservando eu/ID/nãoLidas. Cada agregado usa uma query; os sete totais novos não são sete consultas. COUNT bigint exige inteiro seguro.

A API responde `{itens,proximo}` como antes quando o opt-in não é pedido. Somente `contagens=1` sem cursor acrescenta os cinco `contagens` e o novo `resumo:{contagens,aria}`. `envio=1` restringe os três pelo mesmo escopo; 401/403/400 acontecem antes da criação da operação/consultas. O SSR solicita resumo sempre, após a guarda de sessão/papéis, inclusive com lista vazia e cursor válido. Cursor inválido continua sendo primeira página no SSR; na API é 400. O deep link conserva sua ACL e pode entrar fora dos filtros. `InboxNovo` recebe a propriedade aditiva tipada, sem novos controles visíveis nesta issue. A união dos hunks fusoEscola/assumir da A328 pertence ao integrador.

Uma guarda real identificou a fixture M2 como produção pelo nome `.int.ts`. Foi movida literalmente para `src/test/inbox-contagens-fixture.ts`, com apenas três imports INT atualizados; nenhuma guarda foi alterada. O finding e as identidades M2 históricas permanecem nominais. Evidências/gates finais e limites estão no relatório. Homologação independente, integração/CI e publicação seguem sob ROOT.

Fechamento DEV M3: INT quatro completos/59 seguido da revalidação de três/27 após mover fixture literalmente; UNIT relacionado20/471 preserva seu negativo e três afetados/44 foram revalidados verdes; lint24/TSC auxiliar final EXIT0. São recortes nominais sobrepostos, não suíte global. Nenhuma nova interface visível foi criada. Constância/restauro, QA independente e CI serão atribuídos às execuções do integrador no relatório.

ROOT confirmou restauro491 em72031/460f14 EXIT0, com hashes/snapshot/fixture preservados e zero outra atividade. QA independente e publicação continuam pendentes.


## Revisão de QA M3 — cursor aceito com offset

A QA independente no7138574 passou UNIT20/471, INT4/59 e lint24, mas não aprovou a fonte: oráculo somente leitura demonstrou seis divergências em18combinações de cursor/fuso. O decoder preserva strings Date.parse válidas; o cast direto para timestamp ignorava o offset. O integrador preservou o negativo e acrescentou consulta-sql.cursor.int.test.ts com21combinações reais, em três fusos, CTE VALUES e TX READ ONLY. RED a3fdbe:9falhas/12passes, incluindo os offsets e a entrada legada aceita0 que produzia erroSQL. Nenhuma tabela/fixture foi escrita.

A correção somente normaliza a fronteira temporal com new Date(c.em).toISOString antes do cast. Decoder, NULL, desempate por ID, parametrização, ACL, registry e todos os demais corpos permanecem intactos. GREEN8845ac EXIT0:21/21,3,21s,w1. UNITd8f7a5 EXIT0:dois arquivos completos/seis casos,1,35s,w1;lint2c96bba EXIT0. TSC original26267/03ef61 EXIT0, Node22heap8192/noEmit/incrementalfalse, sem configuração auxiliar ou exclusões extras. Após RED/GREEN, auditoria53cc14 confirmou424hashes/1378registros iguais ao snapshot4834: somente leitura, sem restauro necessário. Esses recortes não são somados nem convertem a QA negativa original em aprovação. Nova QA causal/composiçãoMain/CI continuam pendentes.
