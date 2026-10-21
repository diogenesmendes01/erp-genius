# Incremento 431 — resumo numérico do fechamento no portal

Data: 14/09/2026. Meta integral ativa.

## Implementação

O fechamento confirmado agora inclui projeção explícita do resultado geral, mínimos, quatro habilidades e frequência real do nível. A projeção usa o estado cuja atualidade foi comparada ao fechamento e preserva frações textuais exatas. Não entrega o snapshot de gestão, fontes internas, motivos ou autores.

Sem fechamento ou com fonte alterada, `resumo` é nulo. A tela apresenta números somente nos estados confirmados, em bloco por matrícula/nível separado do acompanhamento por alocação. Uma exceção pedagógica não altera a frequência exibida: o aluno vê os contadores reais, inclusive zero, e uma explicação genérica da autorização aplicável quando necessário, sem evidências reservadas.

## Evidências

- 4/4 integrações ampliadas aprovadas: números 8 e 5, mínimos, frequência de 100%, ausência/revisão sem resumo, frequência real de 0% com fechamento suficiente por exceção independente, isolamento e correção concorrente. `docs/validacao-resumo-portal-431-verificado-2026-09-14.json`.
- A primeira execução identificou comparação excessivamente estrita de um objeto parcial esperado no teste; corrigida para conferir os campos intencionais. Nenhuma regra de produção foi relaxada.
- ESLint direcionado e build completo aprovados, incluindo TypeScript e 62 páginas estáticas. Sem migração ou produção.

## Limites e continuidade

A integração específica de resumo após transferência no mesmo nível ainda está em preparação: comprovar um único item por matrícula/nível, soma correta da frequência histórica e revisão do fechamento de origem. O resumo não inclui o detalhamento completo dos pesos e fontes de cada cálculo; as avaliações oficiais permanecem no acompanhamento permitido. A revisão após progressão executada, correção formal da chamada concluída, homologação visual e demais frentes da SPEC continuam pendentes.
