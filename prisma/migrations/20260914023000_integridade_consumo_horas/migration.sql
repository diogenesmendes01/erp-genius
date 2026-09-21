CREATE FUNCTION conferir_base_consumo_horas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "ReservaHorasCompradas"; c "CompraHorasAntecipadas"; e "EncontroAgenda"; a "AulaDiario"; aluno_id TEXT; total INTEGER;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
 PERFORM id FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
 IF NOT EXISTS (SELECT 1 FROM "Usuario" WHERE id = NEW."autorId" AND ativo AND (papeis && ARRAY['FINANCEIRO','ADMINISTRADOR']::"Papel"[])) THEN RAISE EXCEPTION 'Autor sem permissão para consumir horas'; END IF;
 SELECT * INTO r FROM "ReservaHorasCompradas" WHERE id = NEW."reservaId" FOR SHARE;
 SELECT * INTO c FROM "CompraHorasAntecipadas" WHERE id = r."compraId" FOR SHARE;
 SELECT * INTO e FROM "EncontroAgenda" WHERE id = r."encontroId" FOR SHARE;
 SELECT * INTO a FROM "AulaDiario" WHERE "encontroId" = e.id FOR SHARE;
 SELECT "alunoId" INTO aluno_id FROM "Matricula" WHERE id = c."matriculaId";
 IF r.id IS NULL OR c.id IS NULL OR e.id IS NULL OR a.id IS NULL OR e."matriculaId" IS DISTINCT FROM c."matriculaId" OR e.inicio IS DISTINCT FROM r.inicio OR e.fim IS DISTINCT FROM r.fim OR e.status NOT IN ('PREVISTO','MINISTRADO') OR a."professorId" IS DISTINCT FROM e."professorId" OR a."ocorridaEm" IS DISTINCT FROM e.inicio OR length(trim(a.conteudo)) = 0 OR NEW."estadoDiario" !~ '^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION 'Consumo exige reserva e diário compatíveis';
 END IF;
 SELECT count(*) INTO total FROM "RegistroAulaAluno" WHERE "aulaId" = a.id;
 IF total <> 1 OR NOT EXISTS (SELECT 1 FROM "RegistroAulaAluno" WHERE "aulaId" = a.id AND "alunoId" = aluno_id AND presente IS TRUE) THEN RAISE EXCEPTION 'Consumo por realização exige presença do aluno contratado'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_base_consumo_horas BEFORE INSERT ON "ConsumoHorasCompradas" FOR EACH ROW EXECUTE FUNCTION conferir_base_consumo_horas();

CREATE FUNCTION proteger_base_horas_consumidas() RETURNS trigger LANGUAGE plpgsql AS $$
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
  IF TG_TABLE_NAME = 'EncontroAgenda' AND TG_OP = 'UPDATE' AND OLD.status = 'PREVISTO' AND NEW.status = 'MINISTRADO' AND (to_jsonb(NEW) - 'status') = (to_jsonb(OLD) - 'status') THEN RETURN NEW; END IF;
  IF TG_OP <> 'UPDATE' OR to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN RAISE EXCEPTION 'Registro vinculado a horas consumidas; correção exige revisão financeira'; END IF;
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER proteger_diario_consumido BEFORE UPDATE OR DELETE ON "AulaDiario" FOR EACH ROW EXECUTE FUNCTION proteger_base_horas_consumidas();
CREATE TRIGGER proteger_presenca_consumida BEFORE INSERT OR UPDATE OR DELETE ON "RegistroAulaAluno" FOR EACH ROW EXECUTE FUNCTION proteger_base_horas_consumidas();
CREATE TRIGGER proteger_encontro_consumido BEFORE UPDATE OR DELETE ON "EncontroAgenda" FOR EACH ROW EXECUTE FUNCTION proteger_base_horas_consumidas();
