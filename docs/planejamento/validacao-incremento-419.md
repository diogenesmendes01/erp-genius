# Incremento 419 — persistência local do aproveitamento

2026-09-14. Aplicada somente no banco descartável `localhost:54329/erp_genius_test` a migração `20260915018000_equivalencia_avaliacao`. Proposta, decisão e aplicação têm relações, proteção de histórico e conferências de contexto/papéis. Não houve alteração de produção.

**5/5 integrações** passaram em `resultados.int.test.ts`, incluindo conferência e criação persistida de proposta, idempotência e ausência de transferência nessa etapa. Relatório: `docs/validacao-proposta-equivalencia-419-2026-09-14.json`.

O caso de proposta foi ampliado e passou novamente: recusa hash desatualizado, recusa mesma chave com conteúdo distinto, protege alteração do histórico e bloqueia autoaprovação pelo banco. Relatório: `docs/validacao-guard-proposta-419-2026-09-14.json` (1 aprovado, 4 não selecionados).

A comparação `prisma migrate diff` inicialmente identificou defaults de data. O schema foi alinhado aos defaults UTC com `dbgenerated`, preservando a migração já aplicada; a segunda comparação ficou vazia. TypeScript passou antes das alterações concorrentes dos próximos serviços.

Decisão, execução e tela de preparação ainda estão em implementação. A persistência disponível não comprova o fluxo integral; também faltam fontes de recuperação/aproveitamentos anteriores, fechamento persistido e integração da progressão.
