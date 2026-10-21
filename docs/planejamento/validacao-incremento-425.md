# Incremento 425 — aproveitamento aplicado no resultado

Data: 14/09/2026. Meta ativa; trabalho local com agentes Terra e revisão/integração pelo orquestrador.

## Entrega

O aproveitamento autorizado e executado passa a compor o cálculo por requisito da turma de destino, tanto no acompanhamento da equipe quanto no portal. Não são criados lançamentos locais para representar avaliações da origem. Requisitos não mapeados permanecem pendentes; uma nota intermediária não completa uma habilidade cuja avaliação final está ausente.

O leitor conserva a aplicação e a referência da fonte original. Mudança no hash de uma fonte aprovada gera pendência explícita, sem substituir silenciosamente a nota. Uma nota oficial local prevalece no requisito e não duplica o aproveitamento. A coleta considera fontes aplicadas antes de calcular a melhora por recuperação, inclusive na base dos planos. Cadeias têm detecção de ciclo e limite defensivo; identificadores derivados usam hash para respeitar o limite de tamanho.

As telas distinguem avaliação regular, recuperação e aproveitamento anterior. A gestão vê composição, pendências e prevalência local; o portal apresenta a pendência em linguagem própria para o aluno. A consulta restrita da Secretaria continua sem fontes ou mapa pedagógico.

## Verificação

- **100/100 integrações** em lançamentos, recuperação, pendências, portal e decisão/execução de equivalência: `docs/validacao-regressao-aproveitamento-425-2026-09-14.json`.
- **2/2 integrações novas** com proposta, aprovação e transferência reais, fonte aplicada sem lançamento duplicado, isolamento entre matrículas e invalidação por correção oficial da origem. Conferidos consolidado da equipe e portal: `docs/validacao-aproveitamento-425-corrigido-2026-09-14.json`.
- **17/17 testes unitários** em equivalência, aproveitamento aplicado e elegibilidade do fechamento.
- ESLint direcionado e TypeScript aprovados. Build Next.js completo aprovado, com 62 páginas estáticas.
- A primeira execução dos dois testes novos falhou em expectativas de arrays parciais e no tratamento esperado de requisitos finais ainda ausentes. As expectativas foram corrigidas para verificar explicitamente esses requisitos, sem relaxar o cálculo. Relatório inicial preservado: `docs/validacao-aproveitamento-425-2026-09-14.json`.

## Limites e continuidade

Nenhuma migração nova, operação em produção ou envio externo nesta rodada. Não houve validação visual no navegador. Cadeia de múltiplas transferências e recuperação realizada após aproveitamento possuem lógica implementada, mas ainda precisam de cenários próprios de integração antes de serem consideradas homologadas. Persistência do fechamento Q154, exceção de frequência e integração da progressão continuam pendentes. Os testes desta rodada não comprovam a entrega integral da SPEC.
