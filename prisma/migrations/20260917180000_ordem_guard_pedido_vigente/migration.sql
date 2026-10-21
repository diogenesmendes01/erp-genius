-- PostgreSQL executa triggers do mesmo tipo em ordem alfabética.
-- Adquirir o lock da matrícula antes da guarda anterior bloquear a proposta
-- mantém a mesma ordem das ações Node e evita inversão na inserção direta.
ALTER TRIGGER "AplicacaoAcertoDesistenciaContratual_pedido_vigente_guard"
  ON "AplicacaoAcertoDesistenciaContratual"
  RENAME TO "AplicacaoAcertoDesistenciaContratual_00_pedido_vigente_guard";
