-- A escala e as habilidades devem valer também para escritas que não passam pelas ações.
CREATE FUNCTION conferir_notas_da_avaliacao(registro_id TEXT, notas JSONB, completas BOOLEAN) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r "RegistroAvaliacaoMatricula"%ROWTYPE; regra JSONB; avaliacao JSONB; n JSONB; valor NUMERIC;
BEGIN
 SELECT * INTO r FROM "RegistroAvaliacaoMatricula" WHERE id = registro_id;
 SELECT conteudo INTO regra FROM "VersaoRegraAvaliacao" WHERE id = r."regraId";
 SELECT a INTO avaliacao FROM jsonb_array_elements(regra->'avaliacoes') a WHERE a->>'codigo' = r."codigoAvaliacao";
 IF avaliacao IS NULL OR jsonb_typeof(notas) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Notas incompatíveis com a avaliação'; END IF;
 IF jsonb_array_length(notas) <> jsonb_array_length(avaliacao->'habilidades') OR
  (SELECT COUNT(DISTINCT n->>'habilidade') FROM jsonb_array_elements(notas) n) <> jsonb_array_length(notas) THEN
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

CREATE FUNCTION validar_conteudo_notas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v "VersaoLancamentoAvaliacao"%ROWTYPE; p "PropostaCorrecaoNota"%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME = 'VersaoLancamentoAvaliacao' THEN
  PERFORM conferir_notas_da_avaliacao(NEW."registroId", NEW.notas, NEW.submetida);
 ELSIF TG_TABLE_NAME = 'PropostaCorrecaoNota' THEN
  SELECT * INTO v FROM "VersaoLancamentoAvaliacao" WHERE id = NEW."lancamentoId";
  PERFORM conferir_notas_da_avaliacao(v."registroId", NEW.notas, true);
 ELSIF TG_TABLE_NAME = 'DecisaoLancamentoAvaliacao' AND NEW.aprovada THEN
  SELECT * INTO v FROM "VersaoLancamentoAvaliacao" WHERE id = NEW."lancamentoId";
  PERFORM conferir_notas_da_avaliacao(v."registroId", v.notas, true);
 ELSIF TG_TABLE_NAME = 'DecisaoCorrecaoNota' AND NEW.aprovada THEN
  SELECT * INTO p FROM "PropostaCorrecaoNota" WHERE id = NEW."propostaId";
  SELECT * INTO v FROM "VersaoLancamentoAvaliacao" WHERE id = p."lancamentoId";
  PERFORM conferir_notas_da_avaliacao(v."registroId", p.notas, true);
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER validar_conteudo_notas BEFORE INSERT ON "VersaoLancamentoAvaliacao" FOR EACH ROW EXECUTE FUNCTION validar_conteudo_notas();
CREATE TRIGGER validar_conteudo_notas BEFORE INSERT ON "PropostaCorrecaoNota" FOR EACH ROW EXECUTE FUNCTION validar_conteudo_notas();
CREATE TRIGGER validar_conteudo_notas BEFORE INSERT ON "DecisaoLancamentoAvaliacao" FOR EACH ROW EXECUTE FUNCTION validar_conteudo_notas();
CREATE TRIGGER validar_conteudo_notas BEFORE INSERT ON "DecisaoCorrecaoNota" FOR EACH ROW EXECUTE FUNCTION validar_conteudo_notas();
