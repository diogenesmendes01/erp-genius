# Incremento 540 — autorização visível na operação de recuperação

A consulta do plano reconstrói a situação contratual atual e, para matrícula pausada/encerrada, resolve a autorização vigente de cada tentativa pendente da página. Usa a mesma função de conferência da realização: fonte, habilidade, prazo e papel/atividade atuais do autorizador. A tela mostra o prazo da autorização ou informa sua ausência. O motivo administrativo e os dados internos da autorização não são acrescentados à consulta docente.

Essa informação não declara a realização integralmente liberada: o texto preserva prazo geral do plano, atribuição docente e agenda. O formulário continua permitindo registrar fatos anteriores, cuja data será validada pela ação. Ausência de autorização atual não prova que uma avaliação passada era proibida.

Validação: um cenário integrado aprovado em `docs/validacao-projecao-recuperacao-540-2026-09-15.json`, com 91 casos não selecionados. Conferiu pausa efetivada, fala autorizada e escrita não autorizada, perda da vigência após inativação do autorizador, preservação do bloqueio de novas reservas e realização autorizada. ESLint e TypeScript (`--noEmit --incremental false`) aprovados. Sem ensaio interativo.

## Próxima lacuna confirmada por auditoria Terra

A autorização existente depende de uma tentativa já reservada. Proposta, aprovação, disponibilização e reserva ainda exigem matrícula/vínculo ativos nos respectivos serviços e triggers. Portanto Q151 permanece incompleta para uma pendência identificada que ainda não chegou à reserva.

Um próximo incremento pode atender plano já aprovado e disponibilizado por autorização pré-reserva imutável, delimitada por plano/habilidade, vinculada uma única vez à reserva e validada também na inserção de itens. Deve preservar limite, prazo geral, notas/fontes aprovadas e autorização independente aplicável. Essa etapa não resolverá sozinha pendências sem plano aprovado/disponibilizado: esses caminhos também precisam ser desenhados e implementados dentro do alcance de Q151, sem declarar a exigência de reserva anterior como nova regra de negócio.
