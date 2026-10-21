# Incremento 547 — recuperação preparada após encerramento efetivo

O cenário integrado de encerramento agora exercita dois caminhos: tentativa já preparada antes do encerramento e preparação iniciada somente depois do encerramento efetivado pelo fluxo financeiro. No segundo caminho, registra autorização de preparação, proposta, aprovação por outra pessoa, disponibilização, autorização pré-reserva e reserva; depois exige autorização pontual para realizar a avaliação.

Os testes verificam bloqueio da proposta sem autorização, bloqueio de reserva sem liberação própria e bloqueio de realização sem autorização do item. Ao final, matrícula e alocação são comparadas integralmente com o estado após encerramento: a recuperação não reativa nem altera esses registros.

Dois cenários direcionados aprovados em `docs/validacao-encerramento-completo-547-2026-09-15.json`. ESLint e TypeScript aprovados. A suíte completa de lançamentos acadêmicos passou com 94 testes, zero falhas e zero ignorados (`docs/validacao-academica-547-2026-09-15.json`), incluindo os demais fluxos após as migrations e interfaces recentes.

A revisão independente Terra não identificou troca indevida de matrícula na cadeia de referências. Confirmou que prazo geral, agenda e atribuição docente continuam necessários; autorização específica não concede oportunidade extra nem substitui designação de avaliador. Revisão de código não substitui o ensaio interativo ainda pendente.

Limites: cenários executados em banco local de testes, sem produção ou provedores externos. A validação interativa e a auditoria integral dos requisitos Q151 permanecem necessárias; este incremento não declara a SPEC geral concluída.
