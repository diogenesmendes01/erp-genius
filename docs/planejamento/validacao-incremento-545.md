# Incremento 545 — interface da preparação especial

A página de planos permite à gestão autorizar preparação após pausa/encerramento, com motivo e prazo em fuso explícito. A consulta resolve a autorização vigente mais recente para o vínculo/fonte atuais e a apresenta pelo identificador e prazo, sem motivo administrativo para o docente. O formulário de proposta envia a referência resolvida; mudança de autorização renova a identidade do formulário.

A consulta de planos também confere a autorização específica ao projetar a possibilidade de aprovação, mantendo revisão independente, versão, fontes de notas e limites. Se o autorizador perder atividade/papel, a autorização deixa de habilitar preparação e aprovação. A ação continua revalidando as condições na execução.

Teste integrado direcionado: dois cenários aprovados, zero falhas, 91 não selecionados (`docs/validacao-interface-preparacao-545-2026-09-15.json`). Conferiu consulta normal de planos, gestão autorizadora, professor com preparação permitida sem permissão para autorizar, projeção sem motivo, reenvio pelo adaptador UTC, inativação do autorizador e restauração das opções válidas. ESLint e build aprovados (`docs/validacao-build-545-2026-09-15.log`).

Limites: sem ensaio interativo. Ainda é necessário ampliar os cenários de encerramento e conferir o histórico completo de autorizações na interface. Reserva e realização mantêm suas autorizações específicas, sem reativar a matrícula. Q151 permanece parcialmente validada; não declarar conclusão integral com base nestes cenários.
