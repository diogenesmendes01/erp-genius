# Inbox — aba Atividade (#333)

A aba Atividade existe em todas as finalidades. Lista as mensagens agendadas, apresenta atividade recente e as duas notas internas mais recentes. Este recorte entrega somente leitura e cancelamento; criar, editar, reagendar e enviar agora permanecem fora dele. D11 vigente exige Assumir para criar/editar/enviar agora. Cancelar preserva a operação existente sem acrescentar requisito de Assumir ou permissão de envio.

## Leitura autorizada

O produtor valida primeiro o acesso ao atendimento. Lista intenções diretamente ligadas a ele, com agendadaPara preenchida, status PENDENTE ou ADIADA e passo/passoComercial nulos. Inclui todas as origens e autores autorizados; não altera a lista legada de convites/agendamentos nem o default HUMANO do CRM.

Autoria é apresentação: IA aparece como Aria mesmo quando tem autor humano explícito; autor atual aparece como Você; demais usam nome ou Sistema. A política pura compartilhada por lista e mutação exige tarefas.ver e autor próprio ou Administrador. IA permite somente Administrador, inclusive quando o autorId coincide. Outras origens admitem autor explícito próprio ou Administrador neste contexto Inbox. A alçada de equipe não concede cancelamento de outra pessoa.

Última interação vem de AtendimentoWhatsApp.ultimaMensagemEm. A contagem de conversas usa atendimentos do mesmo contato intersectados com escopoAtendimentos. Tarefas abertas usam o helper #330, com ACL própria e pertença direta OU lead; o fio #332 continua somente direto. Notas reutilizam o produtor E0 após autorização, incluindo seu filtro de arquivamento, e tomam as duas mais recentes. Instantes usam fuso de exibição explícito e fallback institucional; dados ausentes têm texto legível.

## Cancelamento específico do Inbox

A API nova cancelarAgendadaNoInbox delega a um núcleo específico. Não modifica APIs/defaults do CRM, o cancelamento legado WhatsApp ou o histórico da Aria. Cancelar uma intenção IA é uma operação sobre a intenção, não desfazer AcaoAgenteIA.

Na mesma transação: trava o atendimento selecionado com FOR NO KEY UPDATE; trava somente a intenção com vínculo e shape correspondentes no SQL; após todas as esperas relê ator ativo, papéis, capacidade, ACL do atendimento e intenção. Não usa o precheck externo como autorização final nem bloqueia uma intenção NULL de abertura CRM para escolhê-la depois. Não há afirmação de ausência geral de deadlocks entre todos os escritores.

O CAS inclui identidade, atendimento, origem, autor, agenda, passos e estado observado. MensagemAgendadaCancelada usa agregado AtendimentoWhatsApp e payload com intencaoId/atendimentoId/contexto inbox333. Status, Evento e aviso são atômicos. A notificação usa avisarAtendimentoAtualizado(tx, a) do barramento canônico, com id/conversaId do atendimento retornado pela ACL fresca; não toca a PK para emitir aviso e preserva a compatibilidade com KEY SHARE de outra transação. O helper global aviso.ts permanece intacto. O replay do mesmo autor só retorna ok após ACL/pertença/política frescas e marca deste novo contexto; não duplica Evento ou aviso. Não aceita replay cruzado do CRM, cancelamento de outro writer ou outro autor. Não cria schema, migração ou tipo de Evento.

## Tela e sessão

A seção de agendadas só aparece com itens. A prévia é uma linha, o horário tem fuso explícito e somente linhas autorizadas oferecem cancelar. O botão abre ConfirmarAcao real, idempotente por natureza no servidor, com ação direta e confirmação de perigo. Não há retry automático. Voltar não chama a action. Falha e resultado incerto permanecem no diálogo.

O ACK próprio é válido na mesma abertura ainda vigente, inclusive se o SSE já retirou a mensagem da lista. Ausência conhecida antes de iniciar desabilita a confirmação. Revogação conhecida e troca A→B→A invalidam o ACK antigo; uma leitura com texto atualizado atualiza a prévia sem remontar o diálogo. O estado vazio e os resultados usam componentes canônicos. Registros de confirmação e vazio são nominais e fechados, sem parser ou exceção geral.

## Limites da candidata

API global CRM, histórico Aria, ModalTarefa #331 e ConfirmarAcao compartilhado permanecem literais à base eed1cce1. Não inclui #334 nem a revisão visual C3 da PR #439. Sem instalação, migração, geração, provider externo, build ou push pelo DEV. QA independente, gates originais do SHA congelado, CI/build e aceite visual painel-atividade/painel-atividade-agendadas em APP/PROTO original continuam pendentes até suas evidências próprias.
