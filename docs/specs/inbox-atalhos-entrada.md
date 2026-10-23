# Inbox #336 — atalhos de entrada (D21)

Base de implementação: `4c76d200257ea4c3df3707e95100d9180a9efdbc`, branch `codex/inbox-e2-336`. Consome o encoder puro `hrefConversa` da #335. A publicação deve seguir a #335 em main; este checkpoint local não autoriza publicar a história agregada.

## Resolução e acesso

`atendimentoParaAbrir(usuario, alvo, db?)` devolve somente `{ atendimentoId, aberta }` ou `null`. Usuário ausente, papel fora de `PAPEIS_INBOX` e alvo vazio não consultam o banco. Cada busca combina o escopo de leitura existente com conversa individual, sem grupo; não exige permissão de envio.

Prioridade: ID explícito visível, mesmo encerrado; aberto mais recente do lead; aberto mais recente da pessoa; encerrado mais recente das fontes informadas. A ordenação é feita no PostgreSQL por `ultimaMensagemEm DESC NULLS LAST, id DESC`. Um ID negado não concede acesso às buscas seguintes, que reaplicam o mesmo escopo.

`atendimentosParaPessoas` resolve participantes B2B em lote. Deduplica as pessoas solicitadas, calcula o escopo uma vez e consulta páginas de até 100 linhas, primeiro abertas e depois encerradas para as pessoas restantes. O cursor usa data e ID, inclusive a cauda de datas nulas. Não existe consulta por participante nem teto global que esconda uma pessoa antiga. A memória mantém o conjunto solicitado, o mapa de resultados e uma página; o custo de consultas depende das páginas necessárias até resolver as pessoas ou chegar ao fim. O cliente opcional permite executar escopo e consultas na mesma transação, inclusive com pool 1.

Convite vigente somente leitura é suficiente para abrir. Revogação, expiração, troca de dono da linha e ausência de papel continuam sob as políticas existentes. Convite ao atendimento A não autoriza B; um candidato mais novo invisível não esconde um antigo visível. Nenhuma regra ACL, schema, migration ou escrita foi adicionada.

## Consumidores

- Funil: página resolve somente após `obterOportunidade` autorizado; `FunilCliente.aberta.conversa` transporta o DTO ao painel, preservando sua key, histórico e rascunhos. Links no topo, junto ao código.
- Tarefas: página resolve somente após `obterTarefa` autorizado com seus vínculos atendimento/lead/pessoa. Lista, tarefa negada e `t=nova` não consultam atalhos. Links abaixo do status; formulário e actions intactos.
- Contatos: página resolve somente após `obterContato` autorizado e passa o DTO ao cabeçalho da ficha. `server/crm/contatos.ts` permanece intacto, sem sobreposição com a #326.
- Aria: histórico autorizado projeta o escalar `atendimentoId` já existente na ação, conforme Task 16; tabela e cartão mobile oferecem Abrir conversa. A página do Inbox revalida acesso ao destino. Sem nova consulta por item, política de histórico ou Agendar neste consumidor.
- B2B: cada participante recebe o href apenas se o lote encontra conversa visível para sua pessoa; não herda o convite de outro contexto.

As props de conversa são opcionais para preservar consumidores existentes. Aberta oferece “Abrir conversa” e “Agendar mensagem”; encerrada oferece somente Abrir; ausente não cria links. Hrefs usam o encoder da #335, inclusive IDs com caracteres reservados.

## Limite de agendamento e verificação

`/inbox?c=…&agendar=1` é somente o link contratado. O consumidor de agendamento E4 ainda está pendente: esta issue não abre um formulário fictício, agenda, assume atendimento nem envia mensagem.

O relatório `output/inbox-336-report.md` registra os REDs, fixtures corrigidas, gates e comandos. Checkpoint estático não equivale a homologação: visual real, QA independente, regressão global integrada, PR e CI continuam pendentes. O harness compartilhado está reservado à A335; não foi alterado nesta fase.
