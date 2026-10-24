# Inbox #343 — estado da Aria e autoria da prévia no item

`ItemListaInbox` passa a incluir estadoAria, atendidoPorVoce, previaAutor e previaRotulo. A página e o deep link usam a mesma montagem após autorização, preservando o escopo, keyset ultimaMensagemEm DESC NULLS LAST/id DESC, fixadas e limites anteriores. Nenhuma rota, permissão, filtro/chip ou interface nova foi criada nesta issue; os consumidores visuais pertencem às próximas entregas.

O estado é derivado pelo produtor342 congelado. O contexto é carregado uma vez por lote autorizado e as sugestões vêm em uma consulta em lote apenas para os IDs retornados. Lista vazia retorna antes dos loaders e não inicializa ConfigIA; alvo fora da ACL retorna null antes da montagem. atendidoPorVoce compara o usuário ao responsável da CONVERSA, sem usar o dono comercial da oportunidade ou conceder alçada de decisão.

A prévia segue a ordem literal aprovada:

1. Sugestão vigente estritamente posterior à última mensagem, ou sem mensagem: sugestao e somente ACAO_AGENTE_IA_LABEL.
2. Sem mensagem ou ENTRADA: autor/rotulo nulos.
3. SAIDA de IA: aria, mesmo com autorId próprio.
4. SAIDA do próprio usuário: voce, inclusive origem automática com esse autor.
5. SAIDA HUMANO/CELULAR de outro autor com nome: pessoa e primeiro nome, com espaços normalizados.
6. Restantes: nulos, inclusive automático sem autor reconhecido e celular sem autor.

Empate temporal não torna a sugestão mais nova. Estado e autoria são independentes: uma sugestão vigente pode manter aprovacao enquanto uma mensagem posterior vence a prévia. Payload e texto sugerido não são selecionados nem serializados; preview mantém somente a última mensagem, com o resumo anterior. A escolha dessa mensagem usa criadoEm DESC/id DESC para desempate determinista, sem alterar a ordem dos atendimentos.

A quantidade de operações adicionais da Aria é constante por página, sem N+1 ou cap novo: contexto único e sugestões para o conjunto completo, inclusive100 fixadas+200 itens normais. Preferências herdadas ainda agrupam consultas por lidaAte; não se afirma que todo o custo anterior já fosse constante. O contexto342 preserva a inicialização legada de ConfigIA quando há itens; não é uma promessa de ausência absoluta de escrita em toda leitura.

TDD cobre a prioridade de autoria, origens cruzadas, sugestão anterior/igual/posterior, nomes vazios e nenhum payload. Integração cobre página/deep link, responsabilidade, ACL/vazio, handoff/pausa, expiração, empate de mensagem, lote300 e cursor do item301. Apenas literais completos de teste receberam os quatro defaults; não houve mudança de produção cliente, asserts ou drivers. O produtor342 e orçamento permanecem idênticos ao commit54c44b2.

Visual N/A: produtor de DTO sem novo layout/controle; badges, prévia renderizada e cabeçalho chegam em346/348. [Relatório](../../output/inbox-343-report.md). A publicação depende da revisão e merge342; QA independente, composição, CI e merge343 permanecem com ROOT.
