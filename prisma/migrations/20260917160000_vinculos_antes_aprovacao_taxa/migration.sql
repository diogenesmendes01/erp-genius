-- Q170: aprovação fecha os vínculos; nenhuma taxa afetada pode ficar sem acerto identificado.
CREATE OR REPLACE FUNCTION proteger_decisao_conjunto_impactos_taxa_232() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE conjunto "ConjuntoImpactosTaxaAditivo"%ROWTYPE; u "Usuario"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisão de conjunto é imutável'; END IF;
  SELECT * INTO conjunto FROM "ConjuntoImpactosTaxaAditivo" WHERE id=NEW."conjuntoId" FOR UPDATE;
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."decisorId" FOR SHARE;
  IF conjunto.id IS NULL OR conjunto.status<>'PENDENTE' OR NEW."fotografiaHash"<>conjunto."fotografiaHash" THEN RAISE EXCEPTION 'Decisão não corresponde ao conjunto pendente'; END IF;
  IF NEW."decisorId"=conjunto."preparadorId" THEN RAISE EXCEPTION 'Conjunto exige outro Financeiro para decisão'; END IF;
  IF u.id IS NULL OR NOT u.ativo OR NOT (u.papeis && ARRAY['ADMINISTRADOR']::"Papel"[] OR (u.papeis && ARRAY['FINANCEIRO']::"Papel"[] AND u.permissoes @> ARRAY['financeiro.aprovar_acertos'])) THEN RAISE EXCEPTION 'Decisão exige Financeiro autorizado'; END IF;
  IF NEW.aprovada AND EXISTS (
    SELECT 1 FROM "ImpactoTaxaAditivo" i
    WHERE i."conjuntoId"=conjunto.id AND i.decisao='AFETADA' AND i."propostaAcertoId" IS NULL
  ) THEN RAISE EXCEPTION 'Vincule o acerto de cada taxa afetada antes de aprovar o conjunto'; END IF;
  RETURN NEW;
END;
$$;

