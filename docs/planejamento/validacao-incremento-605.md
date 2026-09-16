# Incremento 605 — comprovação de oferta Q161

16/09/2026. Objetivo integral permanece em andamento.

## Implementação

A prévia de continuidade distingue comprovação pela agenda, confirmação pedagógica específica e bloqueio por indisponibilidade. Ausência de relato não é prova positiva.

O detector usa vínculo ativo da própria matrícula, turma aberta/em andamento, grade e calendário aprovados, aulas efetivas da grade, docente ativo e ausência aprovada conferida. Exige agenda que abranja as bordas e tenha encontro no período. Rascunho, cancelamento ou impedimento de aula no período exige conferência. Datas de cobertura são civis UTC; a seleção das aulas considera o dia no fuso do calendário, incluindo o último dia completo. Falta de comprovação retorna necessidade de Gestão, nunca falta de oferta presumida. Período integralmente sem encontros, inclusive eventual recesso, depende da confirmação específica nesta implementação; não é classificado como indisponibilidade automaticamente.

A confirmação positiva possui proposta e decisão imutáveis, versionadas por matrícula e intervalo exato. Secretaria/Gestão/Administração propõem; outra pessoa da Gestão Pedagógica/Administração decide. Exige período, justificativa e evidências textuais. Repetição compatível é idempotente. Nova versão do mesmo intervalo impede consumir aprovação anterior; períodos disjuntos conservam suas cadeias. Uma aprovação atual deve abranger toda a cobertura, sem soma automática de confirmações parciais.

A decisão e o consumo reconsultam os relatos negativos e a projeção do detector de agenda. Relato pendente ou confirmado prevalece e não é encerrado por aprovação positiva. A fonte e seu hash ficam preservados. O hash representa a projeção consultada, não uma cópia completa de todas as tabelas da agenda. O consumo usa somente aprovação com fonte ainda compatível.

Foi criada a tela de confirmação de oferta por matrícula, com proposta, evidências, decisão independente e histórico paginado. Financeiro consulta; comandos de mutação só aparecem quando autorizados. As ações conferem permissões no servidor. Links foram acrescentados à continuidade e à indisponibilidade.

## Banco e validação

Migração **142**, `20260915142000_confirmacao_positiva_oferta_continuidade`, verificada com BEGIN/ROLLBACK antes de aplicar exclusivamente no banco descartável. Cria as duas tabelas, FKs/índices e guards de imutabilidade, versão, papéis, independência e prevalência de indisponibilidade. Não replica todo o detector no SQL. Migração aplicada fica congelada; próxima 143.

- **55/55 integrações aprovadas**: seis de confirmação positiva, 14 de agenda e 35 de aditivos. `docs/validacao-integrada-final-605-2026-09-16.json`.
- A agenda possui conferência de Q161 com publicação real e vínculo da matrícula, em transação revertida da fixture, preservando a regressão existente. Os testes positivos verificam independência, imutabilidade, supersessão, papéis, matrícula diferente da mesma pessoa e intervalo disjunto.
- **10/10 testes unitários/SSR aprovados**: sete do detector, um da prévia e dois da nova tela. `docs/validacao-unitaria-final-605-2026-09-16.json`.
- Tipos, lint e build aprovados: `docs/validacao-tipos-605-2026-09-16.log`, `docs/validacao-lint-final-605-2026-09-16.log`, `docs/validacao-build-605-2026-09-16.log`.

A primeira execução preservada teve falhas: a decisão passava campos extras da proposta ao schema estrito do detector, corrigido com argumentos explícitos; testes editados durante a rodada inicial também tinham uma referência temporária incorreta, removida antes da rodada estável. A repetição final passou integralmente. A revisão independente identificou e corrigiu a falsa comprovação baseada apenas em aulas fora do intervalo.

## Limites

`podeEmitir` segue falso: este incremento não implementa geração recorrente, deduplicação de novas cobranças nem o cron de emissão. Q162 e a composição com outras origens continuam com os limites do incremento 604. A aprovação positiva é uma declaração institucional conferida, não prova automática de que a aula será ministrada. Mudanças que não alterem a projeção do detector não necessariamente mudam o hash da confirmação.

A tela passou por SSR/build, sem homologação interativa no navegador. O fluxo completo de confirmação positiva até sua apresentação numa matrícula com condições contratuais reais ainda precisa de um cenário integrado específico; os testes executados cobrem as ações/consumo, agenda publicada e regressão normal da prévia separadamente. Não houve produção, migração de dados reais, envio de mensagem ou cobrança externa.
