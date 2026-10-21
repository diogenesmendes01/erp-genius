ALTER TABLE "DecisaoReplanejamentoConjunto" ADD COLUMN "excecoesAutorizadas" JSONB NOT NULL DEFAULT '[]';

CREATE OR REPLACE FUNCTION "validar_aplicacao_replanejamento_material_167"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_calendario TEXT; v_decisor TEXT; v_ok BOOLEAN;
BEGIN
 SELECT r."calendarioId", d."decisorId" INTO v_calendario, v_decisor FROM "RascunhoReplanejamento" r JOIN "DecisaoReplanejamentoConjunto" d ON d.id=NEW."decisaoId" WHERE r.id=NEW."rascunhoId";
 IF NOT EXISTS (SELECT 1 FROM "DecisaoCalendarioEscolar" c WHERE c."calendarioId"=v_calendario AND c.aprovada AND c."decisorId"=v_decisor)
    OR NOT EXISTS (SELECT 1 FROM "Evento" e WHERE e.tipo='ReplanejamentoConjuntoAplicado' AND e."agregadoTipo"='ConfiguracaoOperacional' AND e."agregadoId"='escola' AND e.payload->>'revisaoId'=NEW."rascunhoId" AND e.payload->>'decisaoId'=NEW."decisaoId" AND e.payload->>'aprovada'='true') THEN
   RAISE EXCEPTION 'Aplicação conjunta exige calendário publicado e evento transacional';
 END IF;
 SELECT NOT EXISTS (
  SELECT 1 FROM jsonb_array_elements((SELECT snapshot->'revisoes' FROM "RascunhoReplanejamento" WHERE id=NEW."rascunhoId")) t,
    jsonb_array_elements(COALESCE(t->'previsao'->'propostas','[]'::jsonb)) p
  WHERE COALESCE((p->>'alterado')::boolean,false) AND NOT EXISTS (
    SELECT 1 FROM "EncontroAgenda" a WHERE a.id=p->>'encontroId' AND a.inicio=(p->>'inicioProposto')::timestamptz AND a.fim=(p->>'fimProposto')::timestamptz
  )) INTO v_ok;
 IF NOT v_ok THEN RAISE EXCEPTION 'Aplicação conjunta sem os encontros materiais da revisão'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "validar_aplicacao_replanejamento_material_167" AFTER INSERT ON "AplicacaoReplanejamentoConjunto" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "validar_aplicacao_replanejamento_material_167"();