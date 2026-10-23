# #322 — vínculo da tarefa ao atendimento (E2.2)

Base: `1bb721b7e6e72bbfd8f5f8fe7f3f944bef0440b3`, branch própria `codex/inbox-e2-322`. Domínio e schema implementados; gates dirigidos DEV aprovados. UI N/A nesta issue backend. QA independente, global integrado e publicação permanecem pendentes do integrador.

## Resultado e contrato

`Tarefa.atendimentoId` é nullable, com FK para AtendimentoWhatsApp (RESTRICT/CASCADE), inversa e índice por atendimentoId/status. A criação humana aceita o campo somente em CriarTarefaSchema, inclui o valor recebido no hash idempotente e valida a visibilidade de leitura na mesma transação (`atendimentoVisivel(..., false, tx)`). CamposSchema e a edição não mudam; um atendimento adicional recebido em editarTarefa é descartado. Validações de lead, pessoa, responsável, setor, fuso, lembrete e versão otimista permanecem as existentes.

A Aria persiste `acao.atendimentoId`, derivado do turno confiável, ignorando um ID livre da proposta. A tarefa sem oportunidade conserva o vínculo, com responsável null. Os dois produtores incluem atendimentoId string/null em TarefaCriada e no espelhamento já existente do Lead. Sem segundo caminho de criação, endpoint, autorização ou tipo de evento SSE. D10 foi aprovado pelo usuário, mas suas extensões pertencem às tasks próprias, fora deste delta.

Idempotência mantém a trava consultiva e o Evento atuais: replay idêntico repete ID; mesma chave e atendimento diferente conflitam sem outra tarefa/evento/lembrete, inclusive em concorrência. Entrada legada sem campo conserva o hash, sem normalizar null antes da marca. O retorno idempotente continua na ordem existente, antes das validações subsequentes; não foi introduzida nova regra de autorização de replay.

## TDD e correção de fixture

RED inicial91946 terminou com código1: dois arquivos/42testes,25pass e17fail,212,59s. As três falhas da Aria eram causais (vínculo ausente). Os14casos CRM falharam na fixture, pois SECRETARIA é setor, não FinalidadeNumero; não são RED da funcionalidade. Log privado preservado em output/inbox-322-red-integracao.log.

Corrigida somente a fixture para o enum real FinalidadeNumero.COBRANCA com cadastro explícito COMERCIAL, sem cast ou guarda relaxada. A função real setoresDoNumero confirma COMERCIAL, pois cadastro explícito prevalece sobre finalidade legada. RED73553, apenas CRM14, terminou com código1: nove falhas causais/cinco pass,39,33s. Falhas mostraram ausência do vínculo/null, falta de validação de atendimento inexistente/alheio/revogado, edição sem vínculo e hash não distinguindo atendimentos. Hash legado e replays iguais já passavam. Log privado output/inbox-322-red-crm-fixture-corrigida.log.

Somente após os REDs terminais e a reserva explícita dos IDs foram escritos schema, duas SQL e domínio. Exemplos k1/k2 do plano foram usados apenas como caso inválido; casos válidos usam chaves descritivas. O validador vigente continua min8/max100. Nenhum mock da persistência ou do escopo nos testes novos.

## Operação e banco — executados pelo integrador

- Preflight/reserva2ca1b4:452 refs Git distintos e quatro bancos,485 migrations, IDs ainda ausentes. Reserva exclusiva registrada pelo ROOT em2b30f519 para20261023100000_tarefa_atendimento e20261023110000_tarefa_atendimento_indice.
- Banco B foi liberado após RED73553 e restaurado pelo ROOT416b6d:424 hashes/1.372 registros originais. Como não havia tarefa, o integrador criou uma fixture temporária anterior ao DDL para provar nulidade sem vacuidade.
- SchemaReady6b0f5c: lint4/diffcheck0. RevisãoROOT0bef11 aprovou schema/SQL/domínio;817f70 conferiu os três hashes. SessãoROOT28331/2fa10b terminou0: Prisma5.22 gerado somente emB e duas migrations aplicadas.
- Pós-verificação2db2d4 saiu0: colunaTEXT nullable, FK RESTRICT/CASCADE validada, índice btree exato(atendimentoId,status), sem predicado, indisvalid/indisready verdadeiros; duas migrations concluídas. A tarefa anterior conservou null e foi removida.
- SnapshotE2 novo67fd6e saiu0:424 tabelas/1.374 registros/487 migrations, hashes public/snapshot iguais, fixture original3mensagens/1nota preservada. Somente o helper E2 `output/preservar-banco-322-b.mjs` do integrador pode restaurar este banco; nenhum helper E1 foi usado após DDL.

A segunda SQL contém apenas CREATE INDEX CONCURRENTLY IF NOT EXISTS, sem BEGIN/COMMIT. A verificação real do integrador, e não IF NOT EXISTS isoladamente, comprova o índice. Os três arquivos continuam nos hashes SchemaReady registrados nas evidências. Nenhuma geração, migration, SQL, instalação ou cluster foi executado pelo DEV.

## Gates DEV observados até a saída terminal

| Gate | Execução | Resultado |
|---|---|---|
| Integração completa dos quatro arquivos alvo | sessão78268 | saída0;62testes/173,05s;maxWorkers1;sem filtro de nome ou skips |
| Unitário dirigido |15d492|saída0;6arquivos/43testes/4,28s;maxWorkers2;integrações excluídas |
| TypeScript projeto |sessão65848/b72cf0|saída0;--noEmit --pretty false;heap8192 |
| Lint dos quatro arquivos TS alterados |1a8c3d|saída0;zero avisos;--max-warnings0 |

Integração usou vitest.integration.config.ts e perfildev-gravacoes/erp_genius_test_dev_gravacoes, uma única suíte B, com transportes externos desabilitados. Arquivos: tarefa-atendimento.int, executor-crm.int, criar-tarefa-idempotencia.int e tarefas.int, completos. Casos novos cobrem vínculo/payloadnull, leitura sem envio, revogação, carteira/pessoa, edição/versão/escopo, replay/conflito sequencial e concorrente, comando legado, chaves distintas/curtas, origem/contextoAria, sem oportunidade, SUGERIR/SHADOW/NEGAR e rollback.

Unitários: tarefas-regras, permissõesCRM, acoes-capacidadesAria, idempotencia-indice, migrations-encoding e identificacao-registro. Não é suíte global. Warnings existentes de Vite/mixed exports não motivaram alterações de configuração ou regras. Logs são privados e não integram o commit; métricas e hashes curados estão em output/inbox-322-evidencias.json.

## Fechamento e pendências

Após78268, banco B liberado e nenhum teste/preview/browser ativo. ROOT confirmou restauração final E2 pelo novo helper322, execução23337c saída0:424 hashes/1.374registros/487migrations, fixture3mensagens/1nota preservada; nenhum preview ou processo de banco ativo. Esse resultado externo é separado dos gates DEV acima. SPEC em docs/specs/inbox-tarefa-atendimento.md; quadro único atualizado. Commit seletivo, com identidade Git configurada e mensagem funcional, conforme ruling ROOT; nenhum trailer de identidade inventado ou autoria do gerador dos planos.

Sem mudança em package/lock, dependências, src/scripts alheios, UI, servidorSSE, APIs de envio ou regras globais de autorização. Provas visuais não se aplicam ao produtor backend. QA exata, global combinado e PR/push são do integrador; não se presume homologação ou publicação.
