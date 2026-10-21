-- Permite reconstruir conjunto rejeitado/obsoleto sem inventar nova justificativa,
-- mantendo no máximo um conjunto operacional por proposta.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "ConjuntoImpactosTaxaAditivo"
    WHERE status IN ('PENDENTE', 'APROVADO', 'COMPLETO')
    GROUP BY "propostaAditivoId"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Existem conjuntos ativos duplicados; corrija-os explicitamente antes de aplicar a migração';
  END IF;
END;
$$;

DROP INDEX "ConjuntoImpactosTaxaAditivo_propostaAditivoId_fotografiaHash_key";
CREATE INDEX "ConjuntoImpactosTaxaAditivo_propostaAditivoId_fotografiaHash_idx" ON "ConjuntoImpactosTaxaAditivo"("propostaAditivoId", "fotografiaHash");
CREATE UNIQUE INDEX "ConjuntoImpactosTaxaAditivo_propostaAditivoId_ativo_key"
  ON "ConjuntoImpactosTaxaAditivo"("propostaAditivoId")
  WHERE status IN ('PENDENTE', 'APROVADO', 'COMPLETO');
