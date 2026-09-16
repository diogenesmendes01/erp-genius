-- Alinha o nome truncado pelo PostgreSQL ao nome esperado pelo Prisma.
ALTER INDEX "PropostaCancelamentoAgendaRecuperacao_autorId_chaveIdempotencia" RENAME TO "PropostaCancelamentoAgendaRecuperacao_autorId_chaveIdempote_key";
