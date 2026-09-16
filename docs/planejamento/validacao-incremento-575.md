# Incremento 575 — renderização do histórico de segunda chamada

Adicionados dois testes unitários de renderização da página administrativa, com consulta e sessão simuladas e React renderizado no servidor. Verificam links reais de retorno/primeira página/paginação com IDs codificados, ausência de interpolação literal, rótulo de impedimento, escape de conteúdo informado pelo usuário e falha de acesso sem divulgação do histórico.

Os dois testes, lint e TypeScript passaram: `docs/validacao-render-historico-575-2026-09-15.json`. Não usam banco nem alteram fontes usadas pela integração completa 574. Não substituem o teste de autorização real do serviço nem a homologação visual no navegador.

A integração 574 permanece na mesma sessão 83089, ainda sem relatório final ao registrar este incremento. Nenhuma nova integração foi iniciada em paralelo.

## Próxima frente mapeada

A segunda chamada ainda não possui remarcação com proposta/decisão próprias. A reposição individual tem um desenho reutilizável em `src/server/diario/reposicao-agenda.ts`, mas exige adaptação ao prazo, atribuição docente e reserva da segunda chamada. As regras gerais de agenda Q21/Q56 já definem proposta pela Secretaria/gestão e aprovação independente; não foram abertas perguntas redundantes sobre esses papéis. Q149 exige prorrogação própria quando necessária, sem reiniciar prazo automaticamente. Terminal não pode ser reaberto e remarcação não deve consumir nova oportunidade por si só. O mapeamento não significa implementação.
