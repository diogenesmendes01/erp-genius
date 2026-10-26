# Modal de tarefa no Inbox — #331 (D10)

Status: candidata DEV A, sem homologação. Base `1ebbadc79bb42c6543ca8874d31b925ad6ac196e`, branch `codex/inbox-e2-331-modal-tarefa`. Gates originais, revisão independente, visual e publicação dependem do integrador no commit exato.

## Campos e interface

Nova tarefa e Editar tarefa usam Modal canônico com folha no celular, avatar/contato e indicação de conversa vinculada. Título obrigatório até **200** caracteres, com contador200; descrição até2000 por CampoTexto. O exemplo visual17/500 não altera o limite do ERP. Título vazio mantém submit acionável para explicar a validação.

Tipos usam labels centrais; WhatsApp é padrão somente neste modal, sem mudar o CRM. Prazo inicial amanhã09 institucional, atalhos canônicos e data/hora manuais; edição apresenta o prazo existente. Responsável Você/equipe depende de capacidade explícita, não do tamanho da lista. Lembretes: nenhum/na hora/10/30/60; prioridade Normal/Alta em Mais opções. Já foi feita aparece só na criação. Campos extras, baixa, recorrência/colegas e outros lembretes são #338; mensagens agendadas/assunção D11 pertencem à #339.

Abertura é proprietária do atendimento/alvo e tem token independente de versões. Refresh irrelevante preserva o mesmo campo e rascunho; alvo atualizado/ausente invalida o envio sem remontar o formulário. A→B→A, fechar/reabrir e perda de autorização não aceitam ACK antigo. Cancelar tarefa abre uma única confirmação canônica com motivo trim1–500 e botão de perigo bloqueado enquanto vazio. Voltar conserva a edição. A confirmação distingue alteração esperada durante a tentativa própria de erro/resultado incerto; nenhum sucesso é presumido.

## Contratos e vínculos

Actions `dadosModalTarefaNoInbox`, `criarTarefaNoInbox` e `editarTarefaNoInbox` vivem no módulo use-server existente. Nenhuma action pública chama outra action pública/TX. O DTO do modal inclui instante, duração, fuso de origem, versão, capacidade de atribuição e dois tokens de contexto específicos; não amplia TarefaPainel global.

Criar deriva atendimento, oportunidade visível e Pessoa no servidor. Sem oportunidade, tarefa direta é válida. Não recebe IDs arbitrários de lead/Pessoa/aluno/matrícula. Resolução de Pessoa reutiliza painel-detalhes: sem fallback por telefone, por lead oculto ou por responsável legal.

Edição tem intenção interna explícita:

| Intenção | Regra |
| --- | --- |
| manter | Preserva lead/Pessoa, instante e duração quando não editados. A ACL própria da tarefa continua suficiente mesmo se a oportunidade ficou oculta. |
| vincularAtual | Oferecida apenas para oportunidade atual visível e tarefa sem lead ou já ligada a ela; Pessoa incompatível recusa, nunca sobrescreve. |
| remover | Exige que o lead atual da tarefa corresponda à oportunidade atual visível; remove o lead e preserva a identidade Pessoa da tarefa. |

Vínculo de outro contexto fica informativo. O checkbox da edição persiste a intenção, sem retarget silencioso. Remover/vincular revalidam contexto estrito e capacidade de vínculo comercial. Manter usa token de identidade bruta (atendimento/conversa/contato/lead/Pessoa do contato), sem visibilidade derivada: perder apenas visibilidade entre abertura/envio não bloqueia tarefa ainda autorizada. Troca real desses vínculos recusa. Nenhum token substitui a autorização fresca ou autoriza IDs recebidos do cliente.

## Transação, idempotência e calendário

Núcleos internos criarTarefaTx/editarTarefaTx sem use-server foram extraídos do CRM. As APIs públicas, defaults, erro, vínculos aceitos, comportamento sem chave, edição vazia legada e regras de lembrete permanecem. Opções internas de edição recebem somente filtro CAS, vínculo derivado e agenda já resolvida; não mudam a assinatura pública CRM.

Criação: advisory da chave/autor → Config FOR SHARE → Atendimento selecionado FOR UPDATE → referências/Tarefa. Replay também trava a tarefa original antes de revalidar. Edição: Config → Atendimento → Tarefa. Após esperas, relê usuário ativo/papéis/permissões e exige tarefas.ver, atendimentoVisivel, escopoTarefas intersectado com pertença (atendimento direto OR lead atual não nulo). CAS conserva essa interseção, versão e ABERTA. Não acrescenta carteira/assunção/envio à ACL das tarefas.

A chave usa namespace TarefaCriada/autor e hash dos campos normalizados, contexto, fuso e intenções vincular/jaFeita. Advisory vem antes de Atendimento para evitar inversão com criação CRM que pode esperar sua FK. Replay só responde depois da autorização/contexto atuais; devolve o ID original sem reconcluir tarefa alterada/cancelada e sem novos Eventos/aviso. Chave é mantida em erro/incerto, sem retry automático.

Já foi feita cria e conclui na **mesma TX**, com Eventos TarefaCriada/TarefaConcluida e espelhos de Lead quando existentes, sem inventar InteracaoRegistrada. Aviso UPDATE Atendimento participa da mesma TX. Falha em Evento/aviso desfaz criação e conclusão; NOTIFY só aparece no commit.

Edição envia camposAlterados. Título/descrição não reconstroem instante DST nem apagam duração invisível; cliente não submete no-op real. Alteração de agenda valida fuso esperado contra Config, resolve uma vez no fuso escolar e projeta para civil de origem sem reinterpretar texto ambíguo. fusoOrigem é preservado. Lembrete só rearma quando seu instante realmente muda. Não há promessa de linearizabilidade global de ACL ou ausência geral de deadlocks.

## Verificação e pendências

Evidências e negativos em `docs/qa/inbox-331-candidata-dev-a.md`. Schema/lock/deps/client/config permanecem intactos; não houve integração externa, push ou deploy. Banco foi liberado ao ROOT depois do terminal SQL35. TSC/fullUNIT/lint originais, QA independente, APP+PROTO original em três larguras/dois temas e CI continuam pendentes no commit exato.

### Correção independente da agenda efetiva

Na edição com agenda já resolvida, a exigência data/horário do lembrete considera dataCivil/inicioEm dessa agenda, inclusive quando a tarefa anterior não tinha prazo ou possuía somente data. Sem opção interna, a validação pública CRM anterior permanece. O instante resolvido e a comparação do lembrete continuam autoridades; horário DST não é reinterpretado e lembrete idêntico não rearma. A contraprova P2 do TESTER foi reproduzida em unidade e pelo wrapper SQL antes da correção; QA da candidata deve ser refeita na filha.

### Revisão #439 C3 — apresentação do modal

Os chips Tipo apresentam os ícones genéricos MessageCircle, Phone, Mail, Calendar e CircleDot, decorativos e acompanhados pelos rótulos centrais existentes. WhatsApp não usa ícone de marca. O mapa é fechado e exaustivo por TipoTarefa; seleção, aria-pressed e valores enviados permanecem iguais.

O bloco Responsável inteiro, incluindo rótulo e seletor, aparece somente quando dados.podeAtribuirResponsavel é verdadeiro. Lista vazia não esconde uma capacidade concedida, e lista preenchida não cria capacidade. Não há fallback readonly Você/Sem responsável. Ocultar o bloco preserva o estado carregado e não acrescenta alteração de atribuição ao payload da edição.

Os rótulos locais de Lembrete seguem a issue: Sem lembrete, Na hora, 10 min antes, 30 min antes e 1 h antes; valores null/0/10/30/60 inalterados. Título continua limitado a 200, D10 não recebe campos novos e CRM/backend/CAS não são modificados. Evidências desta revisão em docs/qa/inbox-439-c3-modal-tarefa.md; gates originais e aceite visual permanecem coordenados pelo ROOT.