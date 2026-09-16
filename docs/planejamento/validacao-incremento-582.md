# Incremento 582 — atribuição docente no intervalo integral

Criação, reserva e remarcação de segunda chamada passam a usar a mesma fonte SQL para conferir a atribuição do professor durante todo o encontro. A verificação anterior considerava apenas o início e podia permitir término posterior ao fim do vínculo ou da designação.

A migration `20260915124000_escopo_integral_docente_segunda_chamada` cria `professor_segunda_chamada_cobre_intervalo` e integra a verificação ao guard da ligação da agenda com a reserva, preservando os requisitos de contexto, prazo e professor ativo. O intervalo é fechado no início e aberto no fim: terminar exatamente no fim da atribuição é permitido; ultrapassá-lo não é. Cada trecho delimitado por mudanças de vínculo/designação precisa ter cobertura. A última designação conhecida prevalece, sem recuperar implicitamente uma versão anterior que já foi substituída.

A revisão anterior à aplicação também corrigiu uma expressão SQL que poderia tratar ausência de designação como `NULL`, em vez de recusa. A comparação agora produz resultado booleano definido. O wrapper de servidor só aceita retorno explicitamente verdadeiro.

## Evidências

- 57 testes de integração de segunda chamada aprovados, sem falhas ou pendências, incluindo a remarcação existente: `docs/validacao-integrada-582-2026-09-15.json`.
- Cenários novos cobrem vínculo e designação, recusa na criação, reconferência antes da reserva, rollback de inserção direta de agenda fora do escopo e aceitação do término exatamente no limite. Outro cenário comprova que a agenda não recupera designação antiga quando a última não cobre o intervalo.
- TypeScript e lint direcionado aprovados: `docs/validacao-types-582-2026-09-15.log` e `docs/validacao-lint-582-2026-09-15.log`.
- Migration 124 aplicada somente ao banco local descartável pela preparação da integração. Não editar essa migration após esta aplicação. Não houve build ou ensaio visual nesta rodada.

## Limites

Não implementa calendário/exceção de dia não letivo na entrada inicial, proteção integral de atualizações diretas de encontros previstos nem resolução de impedimento escolar (Q164). Não aplica mudanças à produção. Esta correção não comprova conclusão de todo o módulo ou do projeto.
