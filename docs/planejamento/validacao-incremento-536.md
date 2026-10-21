# Incremento 536 — registro da autorização especial de recuperação

Primeira parte de Q151 implementada: schema estrito, validação pura de escopo/validade, modelo Prisma, migration 890 e ação `autorizarRealizacaoEspecialRecuperacao`. A autorização identifica um item já reservado de plano aprovado/disponibilizado, em matrícula pausada ou encerrada, com motivo e prazo futuro. Guarda snapshot das referências e não aumenta tentativas nem realiza avaliações.

O banco exige gestor ativo, fonte correspondente ao item/plano/alocação, ausência de realização/cancelamento e prazo futuro; fixa a criação pelo relógio do banco e impede alteração/exclusão. Uma alocação encerrada pode ser referenciada sem reativação. A ação revalida a gestão dentro da transação, usa locks existentes e retorna o registro original em reenvio idêntico.

Validação:

- Quatro testes unitários de entrada, escopo e validade passaram (`docs/validacao-autorizacao-schema-536-2026-09-15.json`). Datas consideram ano civil e instante UTC entre 0001 e 9999, inclusive ano 0040 bissexto.
- Um cenário integrado passou (`docs/validacao-autorizacao-recuperacao-final-536-2026-09-15.json`), usando plano real aprovado/disponibilizado e reserva. Confere matrícula ativa recusada, professor recusado, repetição segura, chave divergente, fonte falsa/autor docente recusados diretamente no banco, imutabilidade e ausência de realização/novo consumo. Os outros 89 testes do arquivo não foram selecionados nesta execução.
- ESLint e build passaram (`docs/validacao-build-536-2026-09-15.log`). Migration aplicada somente ao banco local de teste e Prisma Client regenerado.

Ainda não concluído: integrar o consumo da autorização em realização e suas proteções no banco, conferir agenda e prazo geral, apresentar autorização na operação/tela e testar pausa/encerramento com histórico efetivo. A consulta pura de validade ainda não é usada para liberar realizações. Uma autorização persistida, por si só, não remove o bloqueio atual. Não houve implantação ou acesso externo.
