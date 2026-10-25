# Inbox — Cliente voltou e outras oportunidades (#329)

A implementação segue a decisão D18: ao voltar a escrever, o cliente reaproveita sua oportunidade anterior por padrão. A [PR #435](https://github.com/diogenesmendes01/erp-genius/pull/435) continua em revisão. O aceite visual da fonte final e a composição com as demais PRs cabem ao integrador; esta especificação não declara a entrega homologada.

## Quando o cartão aparece

O cabeçalho de um atendimento COMERCIAL sem oportunidade vinculada pode mostrar “Cliente voltou” quando o contato possui uma Pessoa explícita, visível para o usuário, não mesclada e sem responsável legal. A leitura escolhe a oportunidade visível ganha ou perdida mais recente, ordenando por criação e ID descendentes.

A escolha acontece antes de conferir o telefone. Não há procura de Pessoa por telefone nem preferência por uma oportunidade mais antiga apenas porque seu número coincide. Um telefone divergente mantém a informação histórica no cartão e desabilita o vínculo.

O DTO também impede o vínculo quando o atendimento selecionado está encerrado, o número está inativo ou é institucional, falta alcance de escrita, os vínculos/Pessoa estão incompatíveis ou o candidato comercial é outro atendimento. A leitura não concede permissão de escrita, movimentação de etapa ou funções CRM ao convidado D13.

## Outras oportunidades e nova oportunidade

A lista usa os rótulos centrais do domínio. Valor zero é exibido normalmente; valor ausente aparece como “Sem valor”. As permissões de abrir o funil, ver o contato e criar uma oportunidade são independentes.

“Nova oportunidade” exige a capacidade global existente `funil.mover`, atendimento COMERCIAL e Pessoa autorizada. O endereço `/funil?nova=<PessoaID>` contém somente o ID codificado. O servidor aplica o escopo antes de preencher o nome e ignora uma Pessoa fora do alcance do usuário. Cancelar remove apenas o parâmetro `nova`, preservando os filtros e `o`. Criar uma oportunidade não vincula automaticamente a conversa.

O aviso de contato sem nome pode coexistir com o cartão. Tags, abas, editores, rodapé e comportamentos da etapa anterior permanecem compostos.

## Vínculo do cartão e vínculo legado

A revisão B2 da PR #435 identificou que a régua específica do cartão havia sido aplicada ao caminho legado de `AcoesContato`. A correção separa as duas operações, mantendo a assinatura e a semântica da ação antiga.

| Origem | Ação | Comportamento |
|---|---|---|
| Cartão “Cliente voltou” | `vincularLeadRetornoNoInbox` | Aplica a régua estrita e atualiza exatamente o atendimento selecionado. |
| “Vincular” em `AcoesContato` | `vincularContatoWhatsApp` | Mantém os vínculos legados de aluno, responsável e oportunidade. O ramo lead conserva o roteamento de contexto anterior. |

O primeiro clique do cartão abre o `ConfirmarAcao` canônico, explica a consequência e coloca o foco no botão seguro. Só “Confirmar vínculo” chama a ação dedicada, com o contato, o atendimento e a oportunidade. O executor declara `idempotente: false`, sem repetição automática após resultado incerto. Voltar ou Escape antes da confirmação não executam a ação; durante o envio, o diálogo bloqueia fechamento e clique duplo. Uma resposta de sessão antiga, inclusive A→B→A, não atualiza outra sessão.

A ação dedicada mantém a ordem Atendimento selecionado → Contato → Lead. Após cada espera, relê o autor ativo, os papéis/permissões, o alcance de escrita, os vínculos, o telefone, a Pessoa e a carteira. Usa CAS, pós-condição e Evento na mesma transação. Não chama o roteamento de inbound, cria outro contexto, reabre histórico ou muda etapa, carteira ou régua. Repetição manual mantém um Evento por POST, sem promessa de idempotência.

No caminho legado, o atendimento ainda precisa ser COMERCIAL e o autor continua sujeito aos papéis e ao escopo anteriores. Número institucional, atendimento selecionado de outra oportunidade, candidato comercial diferente e Pessoa divergente não são novos motivos de recusa. Continuam obrigatórios telefone correspondente, oportunidade na carteira e ausência de outro lead já vinculado ao contato. A Pessoa do contato não é alterada.

O destino legado é resolvido dentro da conversa conforme a regra existente. Os atendimentos comerciais candidatos e o selecionado são travados em ordem de ID antes de Contato e Lead. A transação revalida o conjunto, o destino e a autorização após as esperas. Se aparecer um candidato fora do conjunto travado, recusa e faz rollback, sem tentar outro ID silenciosamente. Um contexto histórico de outra oportunidade permanece intacto; quando necessário, cria-se um novo contexto da oportunidade solicitada. O helper global de inbound não é alterado.

Desvincular lead conserva a ordem selecionado → Contato e a revalidação posterior aos locks. Os demais tipos de vínculo mantêm suas regras e Eventos.

## Validação e limites

As evidências históricas, os negativos, as saídas terminais, os filtros e as contagens ficam no [relatório de QA](../qa/inbox-329-candidata-dev-a.md). A revisão R2 inclui testes reais dos casos legados bloqueados e das recusas preservadas, além da regressão do endpoint dedicado. Testes SQL concorrentes são separados de doubles e de falhas injetadas para verificar rollback; não há alegação de ausência geral de deadlocks ou de serialização global de ACL.

O aceite visual deve comparar a aplicação com o protótipo original nos dois temas e em três larguras. A ausência da pergunta “novo interesse?” é uma diferença deliberada de D18. A confirmação deve ser inspecionada aberta e cancelada sem executar o vínculo no roteiro visual. Capturas, fonte exata e anexos ainda precisam ser admitidos pelo integrador antes da saída de draft.

Não há mudança de schema, migração, dependências, permissões globais ou configuração. Não são enviados dados a providers, mensagens ou e-mails reais nesta fase. Push, CI, composição e merge são etapas separadas.