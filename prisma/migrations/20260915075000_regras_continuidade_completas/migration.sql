-- A transcrição aprovada precisa conter toda a regra; o serviço não é a única
-- barreira contra gravações incompletas. Rejeitar uma proposta antiga continua permitido.
CREATE FUNCTION conferir_regras_continuidade_completas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r jsonb; c jsonb; b jsonb; dia numeric; antecedencia numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'REJEITADA' THEN RETURN NEW; END IF;
  r := NEW.regras; c := r->'continuidadeContratada'; b := r->'regraCobertura';
  IF NOT COALESCE(jsonb_typeof(r) = 'object'
    AND r ?& ARRAY['continuidadeContratada','regraCobertura','diaVencimento','antecedenciaDias','valorOriginal','valorNegociado','moeda','vigenteDesde','ajusteVencimento']
    AND (r - ARRAY['continuidadeContratada','regraCobertura','diaVencimento','antecedenciaDias','valorOriginal','valorNegociado','moeda','vigenteDesde','ajusteVencimento']) = '{}'::jsonb
    AND jsonb_typeof(c) = 'object' AND c ?& ARRAY['contratada','clausula','evidenciaId']
    AND (c - ARRAY['contratada','clausula','evidenciaId']) = '{}'::jsonb
    AND c->'contratada' = 'true'::jsonb
    AND jsonb_typeof(c->'clausula') = 'string' AND length(trim(c->>'clausula')) BETWEEN 1 AND 4000
    AND jsonb_typeof(c->'evidenciaId') = 'string' AND c->>'evidenciaId' = NEW."documentoId"
    AND jsonb_typeof(r->'valorOriginal') = 'string' AND r->>'valorOriginal' ~ '^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$'
    AND jsonb_typeof(r->'valorNegociado') = 'string' AND r->>'valorNegociado' ~ '^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$'
    AND jsonb_typeof(r->'moeda') = 'string' AND r->>'moeda' ~ '^[A-Z]{3}$'
    AND r->'ajusteVencimento' = '"MANTER_DATA"'::jsonb
    AND jsonb_typeof(r->'vigenteDesde') = 'string' AND r->>'vigenteDesde' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    AND jsonb_typeof(r->'diaVencimento') = 'number' AND jsonb_typeof(r->'antecedenciaDias') = 'number'
    AND jsonb_typeof(b) = 'object', false) THEN
    RAISE EXCEPTION 'Regras de continuidade incompletas ou inválidas.';
  END IF;
  dia := (r->>'diaVencimento')::numeric; antecedencia := (r->>'antecedenciaDias')::numeric;
  IF dia <> trunc(dia) OR dia NOT BETWEEN 1 AND 31 OR antecedencia <> trunc(antecedencia)
    OR antecedencia NOT BETWEEN 0 AND 9007199254740991 THEN
    RAISE EXCEPTION 'Dia ou antecedência inválidos.';
  END IF;
  PERFORM (r->>'vigenteDesde')::date;
  IF b->>'referencia' = 'MES_CIVIL' THEN
    IF (b - 'referencia') <> '{}'::jsonb THEN RAISE EXCEPTION 'Referência civil inválida.'; END IF;
  ELSIF b->>'referencia' = 'CICLO_MATRICULA' THEN
    IF NOT COALESCE(jsonb_typeof(b->'dataReferencia') = 'string'
      AND b->>'dataReferencia' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      AND (b - ARRAY['referencia','dataReferencia']) = '{}'::jsonb, false) THEN
      RAISE EXCEPTION 'Referência do ciclo incompleta.';
    END IF;
    PERFORM (b->>'dataReferencia')::date;
  ELSE RAISE EXCEPTION 'Referência de cobertura inválida.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER regras_continuidade_completas
BEFORE INSERT OR UPDATE ON "CondicoesContinuidadeMensalMatricula"
FOR EACH ROW EXECUTE FUNCTION conferir_regras_continuidade_completas();
