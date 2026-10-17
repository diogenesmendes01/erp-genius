
# Task 9 - Verificação da assinatura
- Criados src/server/whatsapp/motor/assinatura.ts e assinatura.test.ts (TDD: falhou sem módulo, depois 8/8 verdes).
- vitest run assinatura.test.ts: 8 passed. tsc --noEmit: 0.
- Desvio: outbox.ts:signature citado no brief não existe no worktree; usei a fórmula HMAC-SHA256 de `${ts}.${corpo}` do brief. Testes extras: timestamp não numérico, assinatura não-hex, timestamp ausente.
