# Incremento 455 — revisão de impactos na transação de decisão

Data: 15/09/2026. Meta integral ativa.

## Entrega

`carregarImpactosCorrecaoAulaTx` concentra a revisão de impactos Q23 usando a transação fornecida pelo chamador. A ação pública autentica, valida a entrada e abre a transação; o coletor conserva a conferência de autorização atual, bloqueios, rejeição, versão da proposta e integridade da fonte. Isso permite reutilizar a mesma coleta na futura aprovação sem abrir outra transação.

A frequência original, a frequência simulada e os respectivos estados de fechamento compartilham um único instante de referência, capturado após o bloqueio do calendário. Uma aula que termina durante a consulta não deve ser tratada como futura em um cálculo e pendente de chamada em outro. O instante opcional é interno e não faz parte da entrada da ação pública.

## Verificação

- Dez testes unitários de projeção, comparação e schema Q23 aprovados.
- TypeScript e lint direcionado aprovados; diff check sem erros.
- 25 testes de integração aprovados em Q23, frequência do nível e fechamento acadêmico. Incluem rejeição ainda não confirmada visível na mesma transação, rollback sem persistência, negação ao professor e mudança coerente de pendência após o fim de uma aula. Relatório: `docs/validacao-impactos-transacao-455-2026-09-15.json`.

## Limites

Esta extração não publica correções. A aprovação, a projeção efetiva persistida e os efeitos dependentes descritos no mapa Q23 continuam pendentes. Não houve migration, deploy, alteração de produção ou envio externo. Sem nova validação visual em navegador.
