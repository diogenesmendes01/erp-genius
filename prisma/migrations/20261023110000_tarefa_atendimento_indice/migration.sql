-- Isolado: CONCURRENTLY não pode ser executado em bloco de transação (#322).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Tarefa_atendimentoId_status_idx" ON "Tarefa"("atendimentoId", "status");
