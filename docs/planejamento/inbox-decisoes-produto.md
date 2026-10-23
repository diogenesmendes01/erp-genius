# Decisões de produto do Inbox — épico #379

Registro das respostas do usuário nesta execução, em 22/10/2026. Os identificadores D abaixo pertencem ao plano do Inbox #379; não substituem decisões de outros projetos com a mesma numeração. Aprovação de produto define o escopo futuro e não significa implementação ou homologação concluída. As entregas e evidências ficam no quadro-entregas.

## Aprovadas

| Decisão | Regra aprovada |
|---|---|
| D1 | O vendedor responsável pela conversa também pode aprovar, rejeitar e desfazer sugestões da Aria, além de Admin e Gerente Comercial. |
| D2 | Aprovar sugestão individual ou pacote inteiro de forma atômica; permitir edição. Mensagem editada sai como humana e pausa a Aria. |
| D3 | Enquanto a Aria conduz, bloquear o compositor externo e permitir nota interna. “Assumir para responder” atribui o responsável, pausa a Aria com motivo MANUAL e cancela sugestões pendentes. |
| D4 | Interruptor global “Aria ativa” no Inbox para Admin e Gerente Comercial, com motivo obrigatório ao pausar. A pausa de uma conversa continua em Assumir. |
| D5 | Transferência unificada para pessoa, setor, fila ou Aria. O responsável pode transferir para colega do mesmo setor sem alterar a carteira comercial. Contexto opcional, com resumo da Aria quando existir. |
| D6 | Mostrar quantidade de conversas abertas por pessoa; equipes correspondem aos setores existentes. Presença automática: online enquanto conectado ao Inbox; ausente após **10 minutos** sem interação; offline ao desconectar com tolerância de60segundos. Visível somente a colegas com permissão de transferência, sem alterar distribuição automática nesta entrega. |
| D9 | Nova conversa por telefone para Admin, Gerente Comercial e vendedor com linha comercial atribuída, usando somente a linha autorizada. Criar contato e oportunidade em Novo (“Prospecção ativa”), com saudação manual editável e sem envio automático. |
| D10 | Tarefas com prioridade baixa, lembretes de 15 min e 1 dia, recorrência diária/semanal/mensal e “notificar também” para colegas autorizados. Remover cancela com motivo e preserva histórico. |
| D11 | Agendadas permitem editar texto/horário, anexar arquivo/proposta, vincular tarefa/oportunidade, enviar agora e reter para confirmação se o contato responder. Exigir assumir a conversa antes de criar, alterar ou enviar imediatamente. |
| D12 | Insights completos com geração de IA **sob demanda pelo botão Atualizar**, reutilizando provedor e controles de custo existentes. Guardar data da geração e indicar novas mensagens ainda não analisadas. Rascunhos e “Escrever com Aria” usam o mesmo texto sugerido; responder continua exigindo as regras de Assumir aprovadas. |
| D13 | Preservar restrição de telefone no pedagógico e abas comerciais somente em conversas comerciais. Acrescentar documento e nascimento opcionais à Pessoa, idade calculada, probabilidade e previsão de fechamento na oportunidade, conforme papéis atuais. O documento deve atender toda a América Latina: **não limitar a CPF**. A implementação deve aproveitar o catálogo existente de país/tipo de documento e seus validadores, incluindo os tipos aplicáveis (DNI, CURP, cédula, passaporte etc.). |
| D20 | @menções em notas com aviso no sino apenas para usuários que podem ver o atendimento; manter marca✦ nas tags criadas pela Aria. |
| D22 | Oferecer Catálogo com materiais ativos já cadastrados para a Aria, sem novo cadastro. |

O usuário autorizou Sol nos dois papéis DEV e no papel TESTER em substituição a Terra indisponível, mantendo o limite de duas funcionalidades em implementação, worktrees próprios e integração coordenada.

## Aplicação

As perguntas de produto enviadas nesta rodada foram respondidas. D7, D8, D14–D19 e D21 seguem as regras atuais do plano até instrução diferente. As extensões de modelo, gerador e UI decorrentes dos spikes deverão virar tasks verificáveis com dependências; sua aprovação não permite encerrar as issues antes da implementação exigida. Novas dúvidas concretas serão apresentadas ao usuário, sem interpretar silêncio como aprovação.

Nenhuma decisão acima autoriza mensagem real, ativação de integrações externas, merge ou deploy nesta fase. Os testes do gerador usarão o provedor simulado e nunca uma chamada externa real.
