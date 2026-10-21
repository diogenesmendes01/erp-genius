# Incremento 542 — interface da autorização pré-reserva

Gestão acessa a nova página pelo plano de recuperação. A página identifica matrícula, oferta e turma; permite escolher uma habilidade do plano, informar motivo e prazo com fuso explícito. Mostra histórico paginado com autoria, prazo e reserva vinculada. A ação de reservar solicita motivo próprio e utiliza a autorização correspondente, mantendo chave idempotente em reenvios sem alteração.

A consulta exige gestão autenticada e reconfere papel/atividade no banco. Confere fontes acadêmicas, situação e vínculo antes de mostrar a possibilidade de autorizar. Para oferecer a reserva também verifica limite, prazo geral, vigência e autor da autorização, fonte e uso anterior. Retorna campos de apresentação, sem expor snapshot, hashes internos da autorização ou papéis do autorizador. O hash do plano necessário à reserva continua restrito à gestão.

O adaptador de horário converte a data local no servidor; a ação principal conserva validação e autorização. Teste integrado passou: rejeição docente, consulta de autorização disponível, campos limitados, repetição da autorização via horário UTC, rejeição de fuso inválido, reserva e posterior indisponibilidade para reutilização. Evidência: `docs/validacao-consulta-reserva-542-2026-09-15.json` (um cenário aprovado, 91 não selecionados). ESLint e build aprovados; compilação registrada em `docs/validacao-build-542-2026-09-15.log`.

Limites: não houve ensaio interativo. Q151 continua incompleta para pendências sem plano aprovado/disponibilizado; o fluxo atual separa autorização da reserva e autorização da realização. A interface orienta esse próximo passo, sem declarar que reservar libera automaticamente a avaliação. Não houve alteração de produção ou envio externo.
