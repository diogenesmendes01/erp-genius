# Incremento 556 — autoria limitada na segunda chamada

Implementado no servidor/banco: registrar a nota original pelo professor que realizou uma segunda chamada sob designação específica, sem criar vínculo com a turma nem permitir lançamentos comuns. A conferência deve exigir designação vigente na data da realização e no momento do registro, preservando a autoria. Uma versão posterior designando outro professor não pode ser ignorada por uma busca filtrada previamente pelo professor antigo.

Teste integrado: designação pela gestão, agendamento, realização pelo substituto, recusa do lançamento comum, troca de responsável impedindo a nota pelo anterior e nova designação liberando apenas a nota própria. Conferir preservação do titular da turma e ausência de vínculo docente criado para o substituto. Onze testes de segunda chamada aprovados, zero falhas e zero não selecionados (`docs/validacao-substituto-segunda-556-2026-09-15.json`). A regressão de lançamentos acadêmicos passou com 96 testes, zero falhas e zero não selecionados (`docs/validacao-regressao-autoria-556-2026-09-15.json`). ESLint e TypeScript aprovados.

## Lacuna de interface confirmada em auditoria Terra

O painel docente de avaliações (`src/server/avaliacoes/painel.ts`) inclui somente `DesignacaoAvaliacao`. A consulta de segunda chamada depende do consolidado do vínculo, que exige o docente atual. Assim, a designação limitada de segunda chamada não fornece uma rota utilizável ao substituto. As ações de realização e nota original também não são chamadas por formulários do app.

Próxima entrega necessária: fila e detalhe limitados às propostas/reservas designadas, com registro de realização e nota original. Não resolver concedendo acesso amplo à turma, reutilizando uma designação mais abrangente ou expondo o consolidado completo. A validação interativa e a implementação integral da SPEC permanecem pendentes.

Migration `20260915102000_autoria_segunda_chamada` e alterações de servidor preparadas pelo agente Terra e revisadas pelo orquestrador. Antes da aplicação no banco de teste, a revisão corrigiu o retorno nulo de designação ausente para falso e preservou a exigência de permissão antes de responder a reenvios. A exceção não permite regularização por pessoa diferente do realizador. Nenhuma alteração em produção.
