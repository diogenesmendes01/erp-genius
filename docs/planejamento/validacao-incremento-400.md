# Incremento 400 — integração inicial de segunda chamada

2026-09-14. Migration179 aplicada somente ao banco descartável. Schema recebeu os modelos e relações da segunda chamada sem substituir os modelos183 já integrados. DDL Prisma com guards consolidados (última definição de cada função), comparação de relógio UTC. Prisma validate/generate passaram; migrate diff vazio.

A suíte179 ainda não passa: execução inicial 8 falhas, depois de corrigir fixture para criação da turma com regra publicada e início posterior conforme o fluxo existente, 2 passaram/6 falharam. Relatório atual docs/validacao-segunda-chamada-400-publicacao-2026-09-14.json. Erros de disponibilização e outras fixtures estão em diagnóstico pelo agente, autorizado temporariamente a executar apenas essa suíte; root não executa outra integração simultaneamente.

Portal: consulta/interface agora usam prazo da etapa de correção, com interrupções limitadas ao intervalo aplicável. Root executou reposicoes.test.ts:2 casos passaram.

Não declarar179 funcional ou concluída. Ciclo185 continua fora migrations. Registros de integração parcial não equivalem à conclusão de Q146–Q152 ou da SPEC completa.
