# Incremento 446 — inventário de dependências da correção de aula

Data: 14/09/2026. Meta integral ativa.

`revisarImpactosCorrecaoAula` permite à gestão conferir uma proposta atual, suas reposições vinculadas e as mudanças acadêmicas aprovadas/executadas no mesmo contrato e nível. Professores não acessam essa conferência institucional. A leitura revalida o estado e a versão da proposta sob a trava da agenda.

O coletor de frequência foi extraído do fluxo Q54 para uso comum, preservando o intervalo histórico semiaberto, a recusa de vínculos ambíguos e a seleção por matrícula/nível mesmo sem equivalência. O inventário de reposições identifica a última conclusão e sua última correção aprovada. O hash contempla a proposta, a fonte atual e esse conjunto de dependências; uma nova reposição altera o hash.

## Evidências

- Onze integrações aprovadas em `docs/validacao-impactos-aula-446-2026-09-14.json`: seis de correção de aula e cinco de regressão do coletor Q54.
- Build, TypeScript, lint direcionado e diff check aprovados.
- Sem alteração de schema ou produção.

## Limites obrigatórios

É um inventário para revisão, ainda sem simulação do resultado corrigido ou publicação. A aprovação futura precisa revalidar esse contexto e acrescentar os efeitos em fechamento, materiais, reservas/consumos e condições financeiras aplicáveis. O hash atual não comprova conferência desses efeitos ainda ausentes. Casos de revisão Q23, projeção efetiva, decisão independente e interface permanecem pendentes. Q23 não está concluído.
