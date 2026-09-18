-- Q23: Prisma parses JSON numerals through JavaScript numbers.  A database
-- photograph containing 0.00 consequently returns as 0 on the next write.
-- This canonicalizer is local to Q23: q165_json_canon remains untouched.
CREATE OR REPLACE FUNCTION q23_json_canon_259(valor JSONB) RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF jsonb_typeof(valor)='object' THEN
    RETURN '{'||coalesce((SELECT string_agg(to_jsonb(chave)::text||':'||q23_json_canon_259(conteudo),',' ORDER BY chave COLLATE "C") FROM jsonb_each(valor) e(chave,conteudo)),'')||'}';
  END IF;
  IF jsonb_typeof(valor)='array' THEN
    RETURN '['||coalesce((SELECT string_agg(q23_json_canon_259(conteudo),',' ORDER BY ordem) FROM jsonb_array_elements(valor) WITH ORDINALITY e(conteudo,ordem)),'')||']';
  END IF;
  -- JSON strings deliberately remain strings. Only JSON numeric lexical scale
  -- is normalized, recursively, before a photograph is hashed or compared.
  IF jsonb_typeof(valor)='number' THEN
    RETURN to_jsonb(trim_scale((valor #>> '{}')::numeric))::text;
  END IF;
  RETURN valor::text;
END $$;

CREATE OR REPLACE FUNCTION q23_fotografia_hash_259(_foto JSONB) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(digest(q23_json_canon_259(_foto),'sha256'),'hex'
) $$;

-- Existing immutable revisions retain their old q165-based hash. They are not
-- rewritten: after this deployment an old hash no longer validates and the
-- regular supersession path requires a new independent review.
CREATE OR REPLACE FUNCTION q23_foto_financeira_valida_257(_proposta_id TEXT,_foto JSONB,_hash TEXT,_proposta_hash TEXT,_versao INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$ DECLARE _atual JSONB; BEGIN
  _atual:=q23_fotografia_financeira_atual_257(_proposta_id);
  RETURN _atual IS NOT NULL AND _proposta_hash=_atual->>'propostaHash' AND _versao=(_atual->>'versaoCorrecaoAula')::INTEGER
    AND _hash=q23_fotografia_hash_259(_foto) AND q23_json_canon_259(_foto)=q23_json_canon_259(_atual);
END $$;

CREATE OR REPLACE FUNCTION q23_fotografia_financeira_materializada_257(_proposta_id TEXT)
RETURNS TABLE(fotografia JSONB, "fotografiaHash" TEXT) LANGUAGE plpgsql AS $$
BEGIN
  fotografia:=q23_fotografia_financeira_atual_257(_proposta_id);
  IF fotografia IS NULL THEN RETURN; END IF;
  "fotografiaHash":=q23_fotografia_hash_259(fotografia);
  RETURN NEXT;
END $$;
