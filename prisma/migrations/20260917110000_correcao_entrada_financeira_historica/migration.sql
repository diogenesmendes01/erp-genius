-- M01/202. Corrige a leitura do registro NEW no constraint trigger deferred.
-- 195 permanece imutável; os dois triggers existentes continuam chamando esta função.
CREATE OR REPLACE FUNCTION "m01_entrada_financeira_commit_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE proposta text;
BEGIN
  -- Não usar CASE com campos de layouts distintos: PL/pgSQL resolve NEW.campo
  -- antes de escolher o ramo. TG_RELID identifica a tabela sem depender de case.
  IF TG_RELID = '"AplicacaoEntradaFinanceiraHistoricaMigracao"'::regclass THEN
    proposta := NEW."propostaId";
  ELSE
    proposta := NEW.id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM "PropostaEntradaFinanceiraHistoricaMigracao" p
    WHERE p.id=proposta AND p.status='APROVADA'
  ) AND NOT EXISTS (
    SELECT 1 FROM "AplicacaoEntradaFinanceiraHistoricaMigracao" a
    WHERE a."propostaId"=proposta
  ) THEN
    RAISE EXCEPTION 'Aprovação M01 exige aplicação correspondente no mesmo commit';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "PropostaEntradaFinanceiraHistoricaMigracao" p
    WHERE p.id=proposta AND p.status='APLICADA'
      AND NOT EXISTS (SELECT 1 FROM "AplicacaoEntradaFinanceiraHistoricaMigracao" a WHERE a."propostaId"=p.id)
  ) THEN
    RAISE EXCEPTION 'Aplicação M01 sem registro correspondente';
  END IF;
  RETURN NULL;
END $$;
