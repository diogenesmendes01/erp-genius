# Incremento 476 — autorização da fonte vinculada

Data: 15/09/2026. Meta integral consultada como ativa. Revisão independente pelo subagente Terra; implementação e testes pelo orquestrador.

## Implementação

A autorização de reprodução no portal exige provedor Google Drive. Quando o material possui vínculo com publicação da aula, confere aula original, arquivo e Drive institucional configurado antes de conceder acesso. Retorna ao adaptador apenas a fonte necessária; a rota usa o Drive conferido. Materiais sem esse vínculo conservam a resolução pelo Drive configurado. IDs internos de publicação e aula não atravessam o resultado da autorização.

O inventário de impactos Q23 inclui `publicacaoAulaId`, sem expor arquivo ou Drive externos. O vínculo passa a participar do contexto e hash da revisão.

## Evidência

- 42 testes de integração aprovados: autorização de gravações e correções Q23. Inclui reprodução da fonte vinculada e recusa após mudança do Drive configurado. Relatório: `docs/validacao-acesso-fonte-476-2026-09-15.json`.
- Quatro testes da rota aprovados, incluindo uso do Drive autorizado, bloqueio antes de consultar o provedor e resposta sem dados internos. Relatório: `docs/validacao-rota-fonte-476-2026-09-15.json`.
- TypeScript e lint direcionado aprovados. Testes de banco executados em um único processo, no banco descartável.

## Limites

Não conclui a SPEC integral. Substituição de gravação por Q23 e propagação de indisponibilidade continuam pendentes. Sem acesso real ao Drive, validação visual, novo build ou deploy nesta rodada. O último build aprovado permanece o do incremento 475.
