-- Inbox E3.1: somente handoffs abertos; comando isolado fora de transacao.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AtendimentoWhatsApp_handoff_aberto_idx"
  ON "AtendimentoWhatsApp"("iaPausadaEm")
  WHERE "iaPausaMotivo" = 'HANDOFF' AND "encerradoEm" IS NULL;
