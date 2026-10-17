
# Task 29 - Mensagem agendada ligada à tarefa e agenda unificada

## O que foi feito
- `src/server/crm/mensagens-agendadas.ts`: numerosParaAgendar, agendarMensagem, reagendarMensagem, cancelarMensagemAgendada, enviarAgora, listarItensAgenda, tipo ItemAgenda.
- `src/server/whatsapp/despachante.ts`: PENDENTE só entra se agendadaPara nulo ou <= agora. A mesma guarda foi aplicada ao ramo ADIADA com despacharAposEm vencido (o brief citava só PENDENTE; sem isso uma ADIADA reagendada para o futuro enviaria cedo). Ramo `comprovante_em_conferencia` intocado.
- Testes: mensagens-agendadas.int.test.ts (9) e despachante-agendada.int.test.ts (3).
- Eventos MensagemAgendada/MensagemReagendada/MensagemAgendadaCancelada no agregado Tarefa (se tarefaId), senão Lead, senão Pessoa. enviarAgora grava MensagemReagendada com enviarAgora:true.
- Mudanças usam updateMany com status in PENDENTE/ADIADA; mensagens de erro específicas por status (ENVIANDO: "A mensagem já está sendo enviada.").

## Desvios
- `TarefaLista` não existe neste worktree (é de outro bloco): defini localmente em mensagens-agendadas.ts como Tarefa + responsável {id,nome}. Trocar pelo tipo oficial na integração.
- Os testes foram escritos junto da implementação, sem execução vermelha prévia separada.
- Reagendar/enviarAgora de ADIADA volta o status para PENDENTE e zera despacharAposEm/motivoFalha.
- listarItensAgenda: tarefas canceladas ficam fora; escopo de mensagens = autor (próprio; equipe com tarefas.equipe e flag equipe; admin tudo), espelhando escopoTarefas. Intervalo em datas civis no fuso institucional.
- agendarMensagem exige contato (pessoaId, leadId ou tarefa com vínculo); reaproveita contatoWhatsApp por pessoaId/leadId/telefone do lead, não cria contato; usa garantirAtendimento COMERCIAL.

## Verificação
- tsc --noEmit: 0. eslint nos arquivos tocados: 0.
- vitest integração: mensagens-agendadas + despachante-agendada + despachante-comercial + despachante.live: 4 arquivos, 33 testes verdes.
- Integração dos 14 arquivos que usam despacharFila: falhas = as 7 preexistentes (visibilidade 6, inbox 1) + 3 em src/server/agenda/substituicao-avisos.int.test.ts, que TAMBÉM falham sem a minha mudança no despachante (verificado com git stash), ou seja, preexistentes na branch e fora da lista da linha de base.
- npm test: 654 arquivos, 4688 testes verdes.
