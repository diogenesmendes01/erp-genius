CREATE OR REPLACE FUNCTION "validar_decisao_replanejamento_conjunto_162"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_preparado TEXT; v_calendario_preparador TEXT; v_ultimo TEXT; v_ativo BOOLEAN; v_papeis "Papel"[];
BEGIN
  SELECT r."preparadorId", c."preparadorId" INTO v_preparado, v_calendario_preparador FROM "RascunhoReplanejamento" r JOIN "VersaoCalendarioEscolar" c ON c.id=r."calendarioId" WHERE r.id=NEW."rascunhoId";
  SELECT id INTO v_ultimo FROM "RascunhoReplanejamento" WHERE "calendarioId"=(SELECT "calendarioId" FROM "RascunhoReplanejamento" WHERE id=NEW."rascunhoId") ORDER BY versao DESC LIMIT 1;
  SELECT u.ativo, u.papeis INTO v_ativo, v_papeis FROM "Usuario" u WHERE u.id=NEW."decisorId";
  IF v_preparado IS NULL OR NEW."rascunhoId" IS DISTINCT FROM v_ultimo OR NEW."decisorId"=v_preparado OR NEW."decisorId"=v_calendario_preparador
     OR NOT v_ativo OR NOT (v_papeis && ARRAY['GERENTE_PEDAGOGICO'::"Papel", 'ADMINISTRADOR'::"Papel"])
     OR length(trim(NEW.motivo)) < 5 OR NEW."estadoHash" IS DISTINCT FROM (SELECT "estadoHash" FROM "RascunhoReplanejamento" WHERE id=NEW."rascunhoId") THEN
    RAISE EXCEPTION 'Decisão conjunta de replanejamento inválida';
  END IF;
  RETURN NEW;
END $$;