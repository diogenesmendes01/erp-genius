-- Q99: o ajuste de vencimento preserva a representação histórica ou registra
-- integralmente o calendário financeiro usado para mover o vencimento.
CREATE OR REPLACE FUNCTION conferir_regras_continuidade_completas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  r jsonb; c jsonb; b jsonb; a jsonb; cal jsonb;
  dia numeric; antecedencia numeric; data_civil text; feriado text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'REJEITADA' THEN RETURN NEW; END IF;
  r := NEW.regras; c := r->'continuidadeContratada'; b := r->'regraCobertura';
  a := r->'ajusteVencimento'; cal := a->'calendario';

  IF NOT COALESCE(jsonb_typeof(r) = 'object'
    AND r ?& ARRAY['continuidadeContratada','regraCobertura','referenciaVencimento','diaVencimento','antecedenciaDias','valorOriginal','valorNegociado','moeda','vigenteDesde','ajusteVencimento']
    AND (r - ARRAY['continuidadeContratada','regraCobertura','referenciaVencimento','diaVencimento','antecedenciaDias','valorOriginal','valorNegociado','moeda','vigenteDesde','ajusteVencimento']) = '{}'::jsonb
    AND jsonb_typeof(c) = 'object' AND c ?& ARRAY['contratada','clausula','evidenciaId']
    AND (c - ARRAY['contratada','clausula','evidenciaId']) = '{}'::jsonb
    AND c->'contratada' = 'true'::jsonb
    AND jsonb_typeof(c->'clausula') = 'string' AND length(trim(c->>'clausula')) BETWEEN 1 AND 4000
    AND jsonb_typeof(c->'evidenciaId') = 'string' AND c->>'evidenciaId' = NEW."documentoId"
    AND jsonb_typeof(r->'valorOriginal') = 'string' AND r->>'valorOriginal' ~ '^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$'
    AND jsonb_typeof(r->'valorNegociado') = 'string' AND r->>'valorNegociado' ~ '^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$'
    AND jsonb_typeof(r->'moeda') = 'string' AND r->>'moeda' ~ '^[A-Z]{3}$'
    AND jsonb_typeof(r->'referenciaVencimento') = 'string'
    AND r->>'referenciaVencimento' IN ('MES_COBERTURA','MES_ANTERIOR','MES_SEGUINTE')
    AND jsonb_typeof(r->'vigenteDesde') = 'string' AND r->>'vigenteDesde' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    AND jsonb_typeof(r->'diaVencimento') = 'number' AND jsonb_typeof(r->'antecedenciaDias') = 'number'
    AND jsonb_typeof(b) = 'object'
    AND (
      a = '"MANTER_DATA"'::jsonb
      OR a = '{"regra":"MANTER_DATA"}'::jsonb
      OR (
        jsonb_typeof(a) = 'object'
        AND a ?& ARRAY['regra','calendario'] AND (a - ARRAY['regra','calendario']) = '{}'::jsonb
        AND a->'regra' = '"PROXIMO_DIA_UTIL"'::jsonb
        AND jsonb_typeof(cal) = 'object'
        AND cal ?& ARRAY['id','versao','referencia','inicioVigencia','fimVigencia','diasSemanaUteis','feriados']
        AND (cal - ARRAY['id','versao','referencia','inicioVigencia','fimVigencia','diasSemanaUteis','feriados']) = '{}'::jsonb
        AND jsonb_typeof(cal->'id') = 'string' AND length(trim(cal->>'id')) BETWEEN 1 AND 200
        AND jsonb_typeof(cal->'versao') = 'number'
        AND jsonb_typeof(cal->'referencia') = 'string' AND length(trim(cal->>'referencia')) BETWEEN 1 AND 2000
        AND jsonb_typeof(cal->'inicioVigencia') = 'string' AND cal->>'inicioVigencia' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        AND jsonb_typeof(cal->'fimVigencia') = 'string' AND cal->>'fimVigencia' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        AND CASE WHEN jsonb_typeof(cal->'diasSemanaUteis') = 'array'
                 THEN jsonb_array_length(cal->'diasSemanaUteis') BETWEEN 1 AND 7
                 ELSE false END
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(cal->'diasSemanaUteis') = 'array' THEN cal->'diasSemanaUteis' ELSE '[]'::jsonb END) AS d(valor)
          WHERE jsonb_typeof(d.valor) <> 'number'
             OR CASE WHEN jsonb_typeof(d.valor) = 'number'
                     THEN (d.valor #>> '{}')::numeric <> trunc((d.valor #>> '{}')::numeric)
                       OR (d.valor #>> '{}')::numeric NOT BETWEEN 0 AND 6
                     ELSE true END
        )
        AND jsonb_typeof(cal->'feriados') = 'array'
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(cal->'feriados') = 'array' THEN cal->'feriados' ELSE '[]'::jsonb END) AS f(valor)
          WHERE jsonb_typeof(f.valor) <> 'string'
             OR CASE WHEN jsonb_typeof(f.valor) = 'string'
                     THEN f.valor #>> '{}' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                     ELSE true END
        )
      )
    ), false) THEN
    RAISE EXCEPTION 'Regras de continuidade incompletas ou inválidas.';
  END IF;

  dia := (r->>'diaVencimento')::numeric; antecedencia := (r->>'antecedenciaDias')::numeric;
  IF dia <> trunc(dia) OR dia NOT BETWEEN 1 AND 31 OR antecedencia <> trunc(antecedencia)
    OR antecedencia NOT BETWEEN 0 AND 9007199254740991 THEN
    RAISE EXCEPTION 'Dia ou antecedência inválidos.';
  END IF;

  data_civil := r->>'vigenteDesde';
  IF substring(data_civil FROM 1 FOR 4) NOT BETWEEN '0001' AND '9999' THEN
    RAISE EXCEPTION 'Data da continuidade fora do intervalo persistível.';
  END IF;
  PERFORM make_date(substring(data_civil FROM 1 FOR 4)::integer, substring(data_civil FROM 6 FOR 2)::integer, substring(data_civil FROM 9 FOR 2)::integer);

  IF b->>'referencia' = 'MES_CIVIL' THEN
    IF (b - 'referencia') <> '{}'::jsonb THEN RAISE EXCEPTION 'Referência civil inválida.'; END IF;
  ELSIF b->>'referencia' = 'CICLO_MATRICULA' THEN
    IF NOT COALESCE(jsonb_typeof(b->'dataReferencia') = 'string'
      AND b->>'dataReferencia' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      AND (b - ARRAY['referencia','dataReferencia']) = '{}'::jsonb, false) THEN
      RAISE EXCEPTION 'Referência do ciclo incompleta.';
    END IF;
    data_civil := b->>'dataReferencia';
    IF substring(data_civil FROM 1 FOR 4) NOT BETWEEN '0001' AND '9999' THEN RAISE EXCEPTION 'Data de referência fora do intervalo persistível.'; END IF;
    PERFORM make_date(substring(data_civil FROM 1 FOR 4)::integer, substring(data_civil FROM 6 FOR 2)::integer, substring(data_civil FROM 9 FOR 2)::integer);
  ELSE RAISE EXCEPTION 'Referência de cobertura inválida.';
  END IF;

  IF a->>'regra' = 'PROXIMO_DIA_UTIL' THEN
    IF (cal->>'versao')::numeric <> trunc((cal->>'versao')::numeric) OR (cal->>'versao')::numeric <= 0 THEN
      RAISE EXCEPTION 'Versão do calendário financeiro inválida.';
    END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(cal->'diasSemanaUteis'))
       <> (SELECT count(DISTINCT (d.valor #>> '{}')::numeric) FROM jsonb_array_elements(cal->'diasSemanaUteis') AS d(valor)) THEN
      RAISE EXCEPTION 'Dia útil financeiro repetido.';
    END IF;

    data_civil := cal->>'inicioVigencia';
    IF substring(data_civil FROM 1 FOR 4) NOT BETWEEN '0001' AND '9999' THEN RAISE EXCEPTION 'Início de vigência fora do intervalo persistível.'; END IF;
    PERFORM make_date(substring(data_civil FROM 1 FOR 4)::integer, substring(data_civil FROM 6 FOR 2)::integer, substring(data_civil FROM 9 FOR 2)::integer);
    data_civil := cal->>'fimVigencia';
    IF substring(data_civil FROM 1 FOR 4) NOT BETWEEN '0001' AND '9999' THEN RAISE EXCEPTION 'Fim de vigência fora do intervalo persistível.'; END IF;
    PERFORM make_date(substring(data_civil FROM 1 FOR 4)::integer, substring(data_civil FROM 6 FOR 2)::integer, substring(data_civil FROM 9 FOR 2)::integer);
    IF cal->>'fimVigencia' < cal->>'inicioVigencia' THEN RAISE EXCEPTION 'Vigência do calendário financeiro invertida.'; END IF;

    FOR feriado IN SELECT jsonb_array_elements_text(cal->'feriados') LOOP
      IF substring(feriado FROM 1 FOR 4) NOT BETWEEN '0001' AND '9999' THEN RAISE EXCEPTION 'Feriado fora do intervalo persistível.'; END IF;
      PERFORM make_date(substring(feriado FROM 1 FOR 4)::integer, substring(feriado FROM 6 FOR 2)::integer, substring(feriado FROM 9 FOR 2)::integer);
      IF feriado < cal->>'inicioVigencia' OR feriado > cal->>'fimVigencia' THEN
        RAISE EXCEPTION 'Feriado fora da vigência do calendário financeiro.';
      END IF;
    END LOOP;
    IF (SELECT count(*) FROM jsonb_array_elements_text(cal->'feriados'))
       <> (SELECT count(*) FROM (SELECT DISTINCT jsonb_array_elements_text(cal->'feriados') AS valor) AS feriados_distintos) THEN
      RAISE EXCEPTION 'Feriado financeiro repetido.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
