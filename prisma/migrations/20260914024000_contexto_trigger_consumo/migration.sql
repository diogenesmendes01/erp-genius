CREATE OR REPLACE FUNCTION proteger_base_horas_consumidas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE encontro_id TEXT; aula_id TEXT;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
 IF TG_TABLE_NAME = 'EncontroAgenda' THEN encontro_id := OLD.id;
 ELSIF TG_TABLE_NAME = 'AulaDiario' THEN encontro_id := OLD."encontroId";
 ELSE
  IF TG_OP = 'INSERT' THEN aula_id := NEW."aulaId"; ELSE aula_id := OLD."aulaId"; END IF;
  SELECT "encontroId" INTO encontro_id FROM "AulaDiario" WHERE id = aula_id;
 END IF;
 IF EXISTS (SELECT 1 FROM "ReservaHorasCompradas" r JOIN "ConsumoHorasCompradas" c ON c."reservaId" = r.id WHERE r."encontroId" = encontro_id) THEN
  IF TG_TABLE_NAME = 'EncontroAgenda' AND TG_OP = 'UPDATE' AND to_jsonb(OLD)->>'status' = 'PREVISTO' AND to_jsonb(NEW)->>'status' = 'MINISTRADO' AND (to_jsonb(NEW) - 'status') = (to_jsonb(OLD) - 'status') THEN RETURN NEW; END IF;
  IF TG_OP <> 'UPDATE' OR to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN RAISE EXCEPTION 'Registro vinculado a horas consumidas; correção exige revisão financeira'; END IF;
 END IF;
 IF TG_TABLE_NAME = 'RegistroAulaAluno' AND TG_OP = 'UPDATE' THEN
  IF (to_jsonb(NEW)->>'aulaId') IS DISTINCT FROM (to_jsonb(OLD)->>'aulaId') AND EXISTS (
    SELECT 1 FROM "AulaDiario" a JOIN "ReservaHorasCompradas" r ON r."encontroId" = a."encontroId" JOIN "ConsumoHorasCompradas" c ON c."reservaId" = r.id WHERE a.id = to_jsonb(NEW)->>'aulaId'
  ) THEN RAISE EXCEPTION 'Registro de destino vinculado a horas consumidas'; END IF;
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
