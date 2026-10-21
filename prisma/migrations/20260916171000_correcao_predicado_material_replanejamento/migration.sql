CREATE OR REPLACE FUNCTION "validar_aplicacao_replanejamento_material_167"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_calendario TEXT; v_decisor TEXT; v_evento JSONB; v_snapshot JSONB; v_total INTEGER; v_evento_total INTEGER;
BEGIN
 SELECT r."calendarioId", d."decisorId", r.snapshot INTO v_calendario, v_decisor, v_snapshot FROM "RascunhoReplanejamento" r JOIN "DecisaoReplanejamentoConjunto" d ON d.id=NEW."decisaoId" WHERE r.id=NEW."rascunhoId";
 IF NOT EXISTS (SELECT 1 FROM "DecisaoCalendarioEscolar" c WHERE c."calendarioId"=v_calendario AND c.aprovada AND c."decisorId"=v_decisor) THEN RAISE EXCEPTION 'Aplicação conjunta exige calendário publicado pela pessoa decisora'; END IF;
 SELECT e.payload INTO v_evento FROM "Evento" e WHERE e.tipo='ReplanejamentoConjuntoAplicado' AND e."agregadoTipo"='ConfiguracaoOperacional' AND e."agregadoId"='escola' AND (e.payload->>'revisaoId')=NEW."rascunhoId" AND (e.payload->>'decisaoId')=NEW."decisaoId" AND (e.payload->>'aprovada')='true';
 IF v_evento IS NULL THEN RAISE EXCEPTION 'Aplicação conjunta exige evento transacional canônico'; END IF;
 SELECT count(*) INTO v_total FROM jsonb_array_elements(v_snapshot->'revisoes') t CROSS JOIN LATERAL jsonb_array_elements(COALESCE(t->'previsao'->'propostas','[]'::jsonb)) p WHERE COALESCE((p->>'alterado')::boolean,false);
 SELECT jsonb_array_length(COALESCE(v_evento->'horarios','[]'::jsonb)) INTO v_evento_total;
 IF v_total=0 OR v_total IS DISTINCT FROM v_evento_total OR EXISTS (
   SELECT 1 FROM jsonb_array_elements(v_evento->'horarios') h WHERE NOT EXISTS (
     SELECT 1 FROM jsonb_array_elements(v_snapshot->'revisoes') t CROSS JOIN LATERAL jsonb_array_elements(COALESCE(t->'previsao'->'propostas','[]'::jsonb)) p
     WHERE COALESCE((p->>'alterado')::boolean,false) AND (p->>'encontroId') IS NOT DISTINCT FROM (h->>'encontroId') AND (p->>'inicioProposto') IS NOT DISTINCT FROM (h->>'inicioProposto') AND (p->>'fimProposto') IS NOT DISTINCT FROM (h->>'fimProposto')
   ) OR NOT EXISTS (SELECT 1 FROM "EncontroAgenda" a WHERE a.id=(h->>'encontroId') AND a.inicio=((h->>'inicioProposto')::timestamptz) AND a.fim=((h->>'fimProposto')::timestamptz))
 ) THEN RAISE EXCEPTION 'Aplicação conjunta sem os encontros materiais da revisão'; END IF;
 RETURN NULL;
END $$;