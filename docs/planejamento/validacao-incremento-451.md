# Incremento 451 — elegibilidade acadêmica na revisão Q23

Data: 14/09/2026. Meta integral ativa.

A conferência institucional de uma proposta de correção de chamada agora apresenta o fechamento acadêmico antes e depois da participação proposta. A simulação reutiliza as notas oficiais, regras, pendências e exceções do fechamento real, sem criar fechamento ou aprovar progressão. Dados insuficientes mantêm uma pendência explícita.

Os metadados da simulação ficam fora do hash acadêmico: preservar a participação não inventa uma mudança no fechamento. O retorno continua identificado como simulação. A autorização permanece restrita à gestão pedagógica/Administração, conferida na transação.

## Validação

- 13 testes de integração aprovados: nove de Q23 e quatro de fechamento acadêmico, incluindo notas suficientes, notas ausentes, preservação da chamada e igualdade do hash quando não há mudança acadêmica.
- Evidência: `docs/validacao-elegibilidade-aula-451-2026-09-14.json`.
- Lint dos três arquivos alterados aprovado; build e TypeScript conferidos nesta rodada.

## Limites

Esta entrega é uma prévia no servidor. Q23 ainda exige decisão independente, aplicação e projeção efetiva, tratamento das dependências financeiras e de materiais, casos de revisão e interface. A simulação não deve ser usada como aprovação nem como fechamento persistido. Sem alteração de schema ou produção.
