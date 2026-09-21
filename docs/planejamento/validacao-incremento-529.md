# Incremento 529 — classificação da cadeia mensal preparada

15/09/2026. Agente Terra preparou um helper puro em arquivos novos; o orquestrador revisou e corrigiu suspensão remanescente e validação de datas. A suíte geral de integração iniciada no incremento 528 continua em execução no mesmo processo. Nenhum arquivo do fluxo ativo foi alterado neste incremento.

## Regra preparada

`conferirCadeiaContinuidade` recebe coberturas já persistidas e sua classificação de status, suspensão e aplicação de período integral. Não consulta o banco, não aprova condições e não cria mensalidades.

- Cobrança cancelada ou regularizada por crédito não serve como referência para a nova cobertura.
- Se essa ocorrência alcançar ou vier depois da última cobertura regular, exige conferência; não é silenciosamente ignorada.
- Uma cancelada antiga inteiramente anterior à última cobertura regular não a substitui como referência.
- Suspensão remanescente exige conferência, inclusive em cobrança cancelada antiga; não comprova retomada.
- Cobertura futura aplicada utiliza as datas atualmente registradas da mesma cobrança.
- Cobertura ausente/invertida, id duplicado ou sobreposição entre coberturas elegíveis impedem confirmar a cadeia. Datas seguem a validação civil persistível compartilhada.

Na revisão, a primeira versão excluía canceladas da verificação de suspensão; isso foi corrigido e recebeu teste específico. A função usa a validação de datas existente, sem manter outra implementação divergente.

## Evidências e integração pendente

Onze testes unitários aprovados em `docs/validacao-cadeia-529-2026-09-15.json`; ESLint dos dois arquivos aprovado.

O helper ainda não está importado pelo carregador de continuidade. A próxima integração deve carregar as aplicações reais da cobrança, preservar a prova de retomada e conferir o comportamento com banco real. Um enum recebido de cliente não comprova aplicação financeira. Esse trabalho aguarda a conclusão da suíte geral para não mudar os arquivos durante a execução. O incremento não é apresentado como correção já disponível no fluxo do ERP.

Q161/Q162 permanecem pendentes; o helper não escolhe comprovação de oferta nem referência após compensação. A emissão recorrente continua incompleta. Nenhuma alteração de produção, migração ou operação externa.
