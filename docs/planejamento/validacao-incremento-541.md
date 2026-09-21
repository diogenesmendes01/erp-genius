# Incremento 541 — autorização para reserva de recuperação

Implementado registro imutável de autorização pré-reserva por plano e habilidade, com motivo, prazo, autoria, chave idempotente e fonte congelada. Exige gestão ativa, matrícula pausada/encerrada e plano aprovado/disponibilizado com fontes de notas conferidas. Não cria reserva, oportunidade extra, nota ou realização por si só.

O serviço de reserva aceita a referência da autorização e revalida matrícula, vínculo, habilidade única, prazo, autorizador e fonte. Uma autorização serve a uma única reserva. Permanecem prazo geral, limite por habilidade e extras previamente aprovadas. O banco também impede inserir outra habilidade posteriormente e confere validade, fonte e vínculo nos itens especiais.

Schema e migration 920 preparados pelo agente Terra e revisados na integração. O primeiro teste identificou colisão de nome entre variável e alias SQL no trigger. A migration 930 corrige essa ambiguidade sem editar a migration já aplicada. Ambas foram aplicadas somente ao banco local descartável.

Teste direcionado: `docs/validacao-reserva-especial-541-2026-09-15.json`. Cenário cobre pausa efetiva, rejeição docente, autorização e reserva idempotentes, recusa sem autorização, habilidade diferente, reutilização, alteração da autorização e limite esgotado.

A regressão completa executou 92 casos: 91 passaram e um rejeitou a mensagem genérica para reserva cancelada (`docs/validacao-academica-541-2026-09-15.json`). A migration 940 restaurou a identificação de cancelamento na mensagem. Repetidos o cenário afetado e o novo fluxo: dois aprovados, zero falhas, 90 não selecionados (`docs/validacao-regressao-final-541-2026-09-15.json`). Não foi repetida a suíte completa após essa correção de mensagem. ESLint e TypeScript aprovados.

A revisão Terra também levou à validação antecipada de nível/regra da turma na ação, com mensagem contextual. A sugestão de corrida entre dois usos da autorização não se confirmou: o fluxo obtém bloqueio da matrícula antes da leitura e exige que a autorização pertença ao mesmo plano; o índice único permanece como proteção adicional.

Pendências: formulário/consulta próprios da autorização pré-reserva ainda não implementados. A realização da nova tentativa durante pausa/encerramento ainda exige a autorização de realização específica já existente. Planos ainda não aprovados/disponibilizados e outros caminhos de Q151 permanecem pendentes; este incremento não redefine a regra de negócio para exigir plano prévio. Não houve ensaio interativo nem operação externa.
