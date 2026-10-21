# Incremento 401 — prorrogação com prazo coerente

2026-09-14. A ação de prorrogar prazo somava durações de indisponibilidades, duplicando intervalos sobrepostos e divergindo da entrega/consulta. Agora usa a mesma união de intervalos, recortada ao início da etapa (disponibilização ou correção), e considera a última prorrogação.

Novo teste cria duas interrupções sobrepostas e verifica prazoAnterior e novoPrazo persistidos. Suiteportal5 testes passaram: docs/validacao-prorrogacao-401-2026-09-14.json. Os6 unitários de cálculo/consulta também passaram. TypeScript e lint executados. Não prova todas as combinações de prorrogação/restrição.

Segunda chamada179 continua sob correção do agente. Banco de testes foi cedido exclusivamente para essa suíte depois do término da execução portal. Ciclo185 ainda não aplicado. Meta global permanece incompleta.
