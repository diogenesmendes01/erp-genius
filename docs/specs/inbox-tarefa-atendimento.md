# Vínculo da tarefa ao atendimento — #322 (E2.2)

Estado: backend implementado e gates dirigidos DEV aprovados. Base do worktree: `1bb721b7e6e72bbfd8f5f8fe7f3f944bef0440b3`. REDs observados antes da implementação; GREEN62 integrações,43 unitários, TypeScript e lint aprovados. QA independente e global integrado pendentes. UI N/A nesta issue: os produtores serão consumidos pelas próximas tasks E2. As extensões D10 já aprovadas pertencem a outras tasks; prioridade, lembrete, recorrência e notificações não mudam aqui.

## Contrato

- `Tarefa.atendimentoId` é opcional, com FK para AtendimentoWhatsApp, `onDelete: Restrict`, `onUpdate: Cascade` e índice por atendimentoId/status. Tarefas anteriores conservam null. O vínculo não concede autorização implícita.
- `criarTarefa` aceita `atendimentoId?: string` somente em CriarTarefaSchema. CamposSchema e editarTarefa descartam esse campo adicional; o vínculo não muda na edição. Versão otimista e demais guardas permanecem vigentes.
- A criação valida `atendimentoVisivel(usuario, id, false, tx)` na mesma transação da tarefa e do evento. Exige leitura, sem exigir envio ou Assumir. Preserva a autorização CRM e as validações de lead, pessoa, aluno, matrícula, responsável, setor, fuso e agendamento.
- O hash idempotente inclui o campo validado. Mesma chave e mesmo atendimento repetem o ID sem tarefa, evento ou lembrete extra; outro atendimento conflita, inclusive em concorrência. Comando legado sem o campo mantém seu hash, sem normalizar null antes da marca. A trava consultiva e o índice Evento existentes continuam os mecanismos de idempotência.
- `TarefaCriada.payload.atendimentoId` é string ou null nos produtores humano e Aria. O espelhamento no Lead é o já existente. Nenhum novo tipo SSE, transporte ou polling.
- A Aria grava `acao.atendimentoId`, derivado do turno confiável, e ignora um campo livre da proposta. Preserva origem IA, autor null, lead, pessoa, responsável e transação atuais. Sem oportunidade, conserva o atendimento com responsável null. SUGERIR, SHADOW e NEGAR não criam tarefa efetiva; rollback não deixa tarefa, evento ou ação.

## Schema e operação

IDs reservados pelo integrador após auditoria de 452 refs e quatro bancos: `20261023100000_tarefa_atendimento` e `20261023110000_tarefa_atendimento_indice`. A primeira migration acrescenta somente coluna nullable e FK; a segunda contém somente CREATE INDEX CONCURRENTLY IF NOT EXISTS, sem BEGIN/COMMIT.

Somente o integrador gera Prisma e aplica SQL no perfil descartável. Ele verifica a definição do índice, indisvalid/indisready e a nulidade das tarefas legadas; IF NOT EXISTS não substitui essa verificação. Depois do DDL, snapshots E1 não restauram o novo esquema. O baseline e snapshot E2 são obrigatórios antes de qualquer integração que trunque o banco.

## Verificação

`tarefa-atendimento.int.test.ts` cobre vínculo, payload null, escopo, participante só de leitura, revogação, guardas legados, edição e idempotência sequencial, concorrente e legada. `executor-crm.int.test.ts` amplia os casos da tarefa com contexto confiável, ausência de oportunidade, SUGERIR/SHADOW/NEGAR e rollback. As regressões completas de `criar-tarefa-idempotencia.int.test.ts` e `tarefas.int.test.ts` integram o GREEN dirigido.

As integrações usam vitest.integration.config, perfil próprio, maxWorkers 1 e uma suíte por banco, sem provedor externo. `output/inbox-322-report.md` registra sessões, códigos e limites. Não se presume aprovação ou homologação.


## PR408 R1 — rastreabilidade da Task2 e gates finais (23/10/2026)

Revisão5632791756, fonte nominal ddf9a9bd51eb6fd54abd2a6e64381a229a25190b. Esta extensão é documental: nenhum teste foi renomeado/reduzido e nenhum código, SQL, schema ou dependência foi alterado. D10 permanece fora do escopo322. Plano consultado em docs/superpowers/plans/2026-10-22-inbox-prototipo-03-painel-crm.md#task-2 no ROOT.

### C5 — critério do plano → teste real e oráculo

Arquivos abaixo são relativos a src/server. As linhas são da fonte ddf, não posições futuras após integração.

| Critério/plano | Caso real | Oráculo adicional preservado |
| --- | --- | --- |
| criarTarefa com atendimentoId grava o vínculo e o TarefaCriada o leva | crm/tarefa-atendimento.int.test.ts:69 — persiste o atendimento e o publica no evento, preservando vínculos, responsável, setor e fuso | tarefa, evento próprio e espelho Lead; responsável/criador, origem, setor, fuso, início e lembrete |
| atendimento fora do escopo recusa sem criar | mesmo arquivo:87 — it.each inexistente/alheio: atendimento %s recusa sem tarefa, evento ou lembrete | erro exato Atendimento não encontrado e contagens de tarefas/eventos/lembretes inalteradas |
| mesma chave com outro atendimento é conflito (#166) | :152 — mesma chave com outro atendimento conflita sem segunda gravação | erro já foi usada e contagens invariantes |
| editarTarefa não troca o atendimento | :131 — editar ignora o atendimento recebido e preserva versão otimista e escopo | vínculo anterior, título e versão2; versão obsoleta e outro autor recusados |
| acrescentar atendimentoId ao tarefa_com_origem_aria | aria/turno/executor-crm.int.test.ts:102 — tarefa_com_origem_aria | atendimento do turno, origemIA, criadornull, lead/responsável/título |
| não regressão idempotência da criação humana | crm/criar-tarefa-idempotencia.int.test.ts:58,73,84,93,104 — a mesma chave duas vezes cria uma tarefa, um lembrete e um Evento, e devolve o mesmo resultado; dois envios simultâneos com a mesma chave criam uma só tarefa; recusa a mesma chave com outra entrada, sem gravar nada; chaves diferentes criam tarefas diferentes, e a chave é de cada autor; sem chave continua criando como antes; chave curta é recusada | arquivo completo conserva os cinco contratos legados, não apenas replay novo |
| não regressão das tarefas | crm/tarefas.int.test.ts:56–213 — arquivo completo, grupos criarTarefa/escopo/versão e transições/editar o agendamento/listarItensLista | papéis/carteira/equipe/fuso, escopo, versão, conclusão/eventos, reabertura/reagendamento, cancelamento sem apagar, assumir fila, lembrete e listagem |

Cobertura adicional322 preservada no arquivo crm/tarefa-atendimento.int.test.ts:

| Linha/nome real | Ligação ao contrato |
| --- | --- |
| :81 sem atendimento mantém a criação antiga e payload com vínculo nulo | compatibilidade nullable/string-ou-null |
| :95 participante só de leitura vincula sem permissão de envio e mantém o setor do autor | atendimentoVisivel(...,false,tx), sem ampliar envio |
| :111 participação revogada não mantém acesso pelo ID conhecido | autorização vigente por leitura |
| :122 vínculo visível não contorna a carteira nem a existência da pessoa | guardas CRM anteriores preservadas |
| :144 replay idêntico devolve o ID e não duplica tarefa, lembrete ou evento | idempotência da entrada vinculada |
| :160 dois envios simultâneos da mesma chave e atendimento criam só uma tarefa | concorrência real, mesmo ID/uma criação |
| :170 chave simultânea com atendimentos diferentes tem um vencedor e um conflito | concorrência com vínculo divergente |
| :181 ausência de atendimento conserva o hash legado e seu replay | hash legado calculado explicitamente |
| :189 chaves diferentes criam vínculos distintos; chave curta não grava | identidade das tentativas e validador existente |

Cobertura adicional no executor-crm.int.test.ts:

| Linha/nome real | Ligação ao contrato |
| --- | --- |
| :109 tarefa da Aria usa o atendimento do turno também no evento, sem confiar em campo da proposta | proposta com ID alheio é ignorada, evento conserva contexto/ator/ação |
| :119 tarefa sem oportunidade conserva o atendimento e responsável nulo | não exige lead para vínculo confiável |
| :138 it.each SUGERIR/SHADOW/NEGAR: tarefa %s não persiste tarefa nem evento efetivo | modo não efetivo não grava tarefa/TarefaCriada |
| :146 rollback da tarefa da Aria não deixa tarefa, evento nem ação | atomicidade de persistência |

Os demais casos do executor (etapa/perda/tag/nota/agendamento/modos/campo/reversibilidade) e de tarefas são regressões do arquivo completo; não foram renomeados para aparentar correspondência literal a exemplos menores do plano. Os nomes completos das regressões de tarefas e o comando dos quatro arquivos estão em output/inbox-pr408-review-todos.md.

### C1–C4 — pendências de integração, sem aceite por documentação

C1 permanece aberto até o integrador executar os quatro arquivos completos no HEAD FINAL, após verificar Prisma/schema e as duas migrations reais nesse ambiente descartável. Os62 testes DEVb29/TESTERcea e os gates ROOTcea são históricos nominais, não nova execução ddf nem do futuro head integrado. Exigir coluna nullable/FK RESTRICT-CASCADE, índice exato válido/pronto e nulidade legada; IF NOT EXISTS isolado não prova isso. Não aplicar a SQL CONCURRENTLY dentro de transação.

C2 exige CI no head final elegível ao workflow de main. C3 exige composição/retarget da pilha e preservação do Pick recente de ItemEstadoCabecalho em estado-visual.ts, sem restaurar ItemListaInbox inteiro de main antigo. C4 exige conciliar os históricos do quadro e os conflitos herdados de harness/docs na integração. Nenhum desses comentários foi declarado resolvido por este mapa; não houve edição remota, banco, migration, Prisma, browser, TSC, testes ou CI nesta rodada exclusivamente MD.
