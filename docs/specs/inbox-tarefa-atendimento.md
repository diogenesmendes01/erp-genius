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
