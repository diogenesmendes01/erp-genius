CREATE OR REPLACE FUNCTION conferir_notas_da_avaliacao(registro_id TEXT, notas JSONB, completas BOOLEAN) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r "RegistroAvaliacaoMatricula"%ROWTYPE; regra JSONB; avaliacao JSONB; n JSONB; valor NUMERIC;
BEGIN
 SELECT * INTO r FROM "RegistroAvaliacaoMatricula" WHERE id = registro_id;
 SELECT conteudo INTO regra FROM "VersaoRegraAvaliacao" WHERE id = r."regraId";
 SELECT a INTO avaliacao FROM jsonb_array_elements(regra->'avaliacoes') a WHERE a->>'codigo' = r."codigoAvaliacao";
 IF avaliacao IS NULL OR jsonb_typeof(notas) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Notas incompatíveis com a avaliação'; END IF;
 IF jsonb_array_length(notas) <> jsonb_array_length(avaliacao->'habilidades') OR
  (SELECT COUNT(DISTINCT item.value->>'habilidade') FROM jsonb_array_elements(notas) AS item(value)) <> jsonb_array_length(notas) THEN
  RAISE EXCEPTION 'Configure exatamente as habilidades da avaliação';
 END IF;
 FOR n IN SELECT * FROM jsonb_array_elements(notas) LOOP
  IF jsonb_typeof(n) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Formato de nota inválido'; END IF;
  IF (SELECT COUNT(*) FROM jsonb_object_keys(n)) <> 3 OR NOT (n ?& ARRAY['habilidade','nota','comentarioAluno']) OR
   jsonb_typeof(n->'habilidade') IS DISTINCT FROM 'string' OR NOT (avaliacao->'habilidades' ? (n->>'habilidade')) OR
   jsonb_typeof(n->'comentarioAluno') IS DISTINCT FROM 'string' OR length(n->>'comentarioAluno') > 2000 THEN
   RAISE EXCEPTION 'Habilidade ou comentário inválido';
  END IF;
  IF n->'nota' = 'null'::jsonb THEN
   IF completas THEN RAISE EXCEPTION 'Notas completas são obrigatórias'; END IF;
  ELSE
   IF jsonb_typeof(n->'nota') IS DISTINCT FROM 'string' OR length(n->>'nota') > 100 OR (n->>'nota') !~ '^-?[0-9]+([.][0-9]+)?$' THEN RAISE EXCEPTION 'Formato numérico da nota inválido'; END IF;
   valor := (n->>'nota')::NUMERIC;
   IF valor < (regra->'escala'->>'minimo')::NUMERIC OR valor > (regra->'escala'->>'maximo')::NUMERIC THEN RAISE EXCEPTION 'Nota fora da escala'; END IF;
  END IF;
 END LOOP;
END;
$$;

