# #338 — tarefas D10 no Inbox

Implementação DEV local; QA independente, visual obrigatório `tarefa-nova-mais-opcoes`, seleção pública e CI permanecem pendentes. Não marca a issue concluída. O antecessor funcional é #331/PR439; o porte público deve selecionar os hunks D10, preservando contratos atuais, sem importar a ancestry privada de GP/Documento/372.

## Formulário e permissões

Prioridade BAIXA usa o rótulo canônico. Lembretes aceitam 15min/1dia, preservando0/10/30/60/null. Mais opções mantém campos/draft montados; fold/refresh de contexto não apaga a edição. Recorrência diária/semanal/mensal e não repetir. Sem data não se ativa recorrência; data sem hora mantém inicioEmNULL, sem inventar horário.

Notificar também seleciona colegas ativos com `tarefas.ver` e alçada própria da tarefa: Admin, responsável atual, fila do setor ou equipe canônica atual. Seleção não concede leitura nem exige visibilidade do Lead para uma Task diretamente autorizada. Catálogo paginado100 não trunca em200;200 é o máximo do conjunto selecionado, normalizado/deduplicado. DTO de candidatos contém somente id/nome. Omitir preserva o conjunto,[] limpa; conjunto idêntico não reescreve relações ou rearma lembrete. Cancelar mantém motivo e histórico, sem DELETE ou cancelamento de outra ocorrência.

Preview sequencia pedidos e recusa tupla catálogo/contexto/Task/atribuição alterada após I/O; não substitui silenciosamente o draft. Confirmação não confia na lista: writer revalida ator/atribuição/colegas na TX com CAS/Eventos/aviso transacional. User KEY SHARE protege FK, não congela papéis; NOWAIT traduz55P03 fora da TX abortada, sem esconder40P01/P2028. Não há alegação de linearização global de ACL.

O cron deduplica responsável/colegas e conta tarefas com entrega. Zero elegíveis estáveis consome o ciclo e audita SEM_DESTINATARIO_AUTORIZADO. Cada tarefa usa TX própria: depois dos INSERTs e novamente após o Evento, reconcilia Task/lease/estado/versão, relações e conjunto elegível. Mudança durante os awaits aborta somente o claim/notificações/Evento daquela tarefa; as demais continuam. Ao fim, erro único propaga por identidade e múltiplos preservam causas em AggregateError, sem sucesso zero falso ou retry cego. Leitor do sino aplica ACL atual em lotes/keyset e conserva menção/SLA independentes.

## Recorrência ancorada

Decisões humanas: calendário ORIGINAL, pular vencidas;31jan→último fevereiro→31mar. DST ajusta automaticamente e registra: gap avança ao primeiro minuto civil válido; fold usa primeira ocorrênciaUTC, sem duplicatas ou revisão manual. A função pura recebe âncora original/data-hora-fuso, índiceAtual e corte; mantém mínimo índiceAtual+1 inclusive conclusão antecipada e salta atraso aritmeticamente sem varrer anos. Ajuste de um filho não desloca a âncora.

Conclusão e intenção durável compartilham TX. Corte original e snapshot são imutáveis. Reabertura cancela intenção pendente sem apagar histórico ou alterar filho já existente. Materialização posterior tem TX própria: primeiro reconcilia predecessor-filho confirmado, antes do relógio/cálculo. Sem filho captura UM agora por tentativa e usa corteEfetivo=max(original,agora). Aborto sem filho permite outro agora; ACK perdido retorna o mesmo filho e não emite outro Evento. Cada predecessor tem filho único.

Ordem materializador: alvos FK/usuários estáveis antes de Tarefa→Intenção; releitura de vínculos/estado/snapshot, CAS e conferência atual final de responsável/colegas depois dos writes. Snapshot não concede papéis. IMPEDIDA_CONTEXTO aceita VINCULO_INDISPONIVEL/VINCULO_ALTERADO/RESPONSAVEL_INDISPONIVEL/VERSAO_ALTERADA e SNAPSHOT_INVALIDO exclusivamente para snapshot estruturalmente inválido da versão numérica1 suportada. Esse caso relê identidade/snapshot sob locks Tarefa→Intenção e CAS; falha do Evento reverte o impedimento. Versão futura, relógio inválido e falha inesperada não são consumidos. Erros de infraestrutura propagam, não viram impedimento nem retry genérico. Audita IDs/índice/cortes/ajuste civil/fuso/política, sem copiar título/descrição/documentos nos novos Eventos.

## Persistência e evidências

497/498 literais imutáveis e503 `20261026040000_inbox_tarefa_recorrencia_d10`, reservadas/aplicadas pelo ROOT. Schema foi alterado por delta mínimo, preservando Doc/GP.503 inclui CHECKsnapshot completo IS TRUE e versão numérica1, índices/unicidade da intenção e predecessor. `.gitattributes` acrescenta somente LF497/498/503. DEV não aplicou DDL nem gerou cliente. A503 do DEV tem501migrações/428tabelas/567linhas; único restorer é do ROOT, cliente861b/perfil dev-email.

QA DEV atual em [inbox-338-d10-r30-dev.md](../qa/inbox-338-d10-r30-dev.md). O núcleo puro foi validado em checkpoint local anterior com31casos; a QA funcional registra sua proveniência.45 nativos distintos aprovados são recortes da funcionalidade, não integração global. Provas temporais cobrem o produtor Prisma real em UTC/SP, não INSERT SQL bruto arbitrário. Gates globais da árvore são registrados na QA após saída terminal, sem presumir CI ou visual.
## PR458 C1/C3/C4 — isolamento de execução e orientação

O cron executa recorrência e lembretes como etapas independentes protegidas pelo seguro existente; a resposta expõe recorrenciasTarefas separadamente. Rodar lembretes diretamente não materializa recorrências. O lote de recorrência mantém50itens ordenados, uma TX por intenção e continua itens independentes após uma falha; propaga erro original único ou AggregateError com causas depois do lote. Snapshotv1 estruturalmente inválido é impedido/auditado sem criar filho, evitando bloquear permanentemente a janela50. Infra permanece erro, nunca impedimento ou retry automático.

No Modal, ao editar uma tarefa recorrente e manter sua frequência, a orientação explica que alterar data/hora muda apenas esta ocorrência e as próximas seguem o calendário original. Criação, NAO_REPETE ou troca da frequência não exibem essa promessa. Não muda DTO nem âncora/cálculo; o payload continua só diff da ocorrência.

O produtor de lembretes e o materializador atuais não emitem AvisoInbox/pg_notify. A atomicidade aqui demonstrada é claim, NotificacaoUsuario e Evento; não alegar prova de NOTIFY do commit por instrumentação de teste. Produtores Inbox que já notificam mantêm seus próprios gates transacionais. Sem novo envio, schema ou política de acesso.
