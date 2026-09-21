-- Q151: a situação contratual é reconstruída no instante da realização; o
-- status atual não substitui a trilha temporal de pausa, retomada e término.
CREATE FUNCTION situacao_matricula_no_instante(matricula_id TEXT, instante TIMESTAMP)
RETURNS TEXT LANGUAGE plpgsql STABLE AS $$
DECLARE
  status_atual TEXT;
  ativada_em TIMESTAMP;
  status_conferido TEXT;
  encerramento RECORD;
  movimento RECORD;
  snapshot JSONB;
  data_texto TEXT;
  fuso TEXT;
  fuso_unico TEXT;
  estado_atual TEXT := 'ATIVA';
  estado_na_aula TEXT := 'ATIVA';
  aplicado_anterior TIMESTAMP;
  data_anterior DATE;
  data_movimento DATE;
  data_aula DATE;
  indice INTEGER := 0;
BEGIN
  IF instante IS NULL OR NOT isfinite(instante) THEN RETURN 'A_CONFERIR'; END IF;
  SELECT status::text, "ativadaEm" INTO status_atual, ativada_em
    FROM "Matricula" WHERE id = matricula_id;
  IF NOT FOUND OR ativada_em IS NULL OR NOT isfinite(ativada_em) THEN RETURN 'A_CONFERIR'; END IF;
  IF instante < ativada_em THEN RETURN 'NAO_ATIVADA'; END IF;

  SELECT "statusAnterior", "limiteVinculo" INTO encerramento
    FROM "RegistroEncerramentoMatricula" WHERE "matriculaId" = matricula_id;
  IF FOUND THEN
    IF status_atual <> 'ENCERRADA' OR encerramento."statusAnterior" NOT IN ('ATIVA', 'PAUSADA')
       OR encerramento."limiteVinculo" IS NULL OR NOT isfinite(encerramento."limiteVinculo")
       OR encerramento."limiteVinculo" < ativada_em THEN
      RETURN 'A_CONFERIR';
    END IF;
    IF instante >= encerramento."limiteVinculo" THEN RETURN 'ENCERRADA'; END IF;
    status_conferido := encerramento."statusAnterior";
  ELSE
    status_conferido := status_atual;
  END IF;
  IF status_conferido NOT IN ('ATIVA', 'PAUSADA') THEN RETURN 'A_CONFERIR'; END IF;

  -- Primeiro valida toda a fonte. Isso corresponde aos safeParse do app antes
  -- de ordenar os movimentos por data civil e instante de aplicação.
  FOR movimento IN
    SELECT p.snapshot, p."aplicadaEm", 'PAUSADA'::text AS estado
      FROM "ItemPropostaPausa" i JOIN "PropostaPausaMatriculas" p ON p.id = i."propostaId"
      WHERE i."matriculaId" = matricula_id AND p.status = 'APLICADA'
    UNION ALL
    SELECT p.snapshot, p."aplicadaEm", 'ATIVA'::text AS estado
      FROM "ItemPropostaRetomadaMatriculas" i JOIN "PropostaRetomadaMatriculas" p ON p.id = i."propostaId"
      WHERE i."matriculaId" = matricula_id AND p.status = 'APLICADA'
  LOOP
    snapshot := movimento.snapshot;
    IF snapshot IS NULL OR jsonb_typeof(snapshot) <> 'object'
       OR movimento."aplicadaEm" IS NULL OR NOT isfinite(movimento."aplicadaEm") THEN
      RETURN 'A_CONFERIR';
    END IF;
    IF movimento.estado = 'PAUSADA' THEN data_texto := snapshot ->> 'dataEfetiva';
    ELSE data_texto := snapshot ->> 'retorno'; END IF;
    fuso := snapshot ->> 'fusoInstitucional';
    IF NOT COALESCE(jsonb_typeof(snapshot -> (CASE WHEN movimento.estado = 'PAUSADA' THEN 'dataEfetiva' ELSE 'retorno' END)) = 'string'
       AND jsonb_typeof(snapshot -> 'fusoInstitucional') = 'string'
       AND data_texto ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       AND fuso ~ '^[A-Za-z_]+(?:/[A-Za-z0-9_+\-]+)*$', false) THEN
      RETURN 'A_CONFERIR';
    END IF;
    PERFORM data_texto::date;
    PERFORM instante AT TIME ZONE 'UTC' AT TIME ZONE fuso;
    IF fuso_unico IS NULL THEN fuso_unico := fuso;
    ELSIF fuso_unico <> fuso THEN RETURN 'A_CONFERIR'; END IF;
  END LOOP;

  FOR movimento IN
    SELECT movimentos.data_texto, movimentos.fuso, movimentos."aplicadaEm", movimentos.estado FROM (
      SELECT p.snapshot ->> 'dataEfetiva' AS data_texto, p.snapshot ->> 'fusoInstitucional' AS fuso,
        p."aplicadaEm", 'PAUSADA'::text AS estado
      FROM "ItemPropostaPausa" i JOIN "PropostaPausaMatriculas" p ON p.id = i."propostaId"
      WHERE i."matriculaId" = matricula_id AND p.status = 'APLICADA'
      UNION ALL
      SELECT p.snapshot ->> 'retorno', p.snapshot ->> 'fusoInstitucional', p."aplicadaEm", 'ATIVA'::text
      FROM "ItemPropostaRetomadaMatriculas" i JOIN "PropostaRetomadaMatriculas" p ON p.id = i."propostaId"
      WHERE i."matriculaId" = matricula_id AND p.status = 'APLICADA'
    ) movimentos
    ORDER BY movimentos.data_texto, movimentos."aplicadaEm"
  LOOP
    data_movimento := movimento.data_texto::date;
    IF movimento.estado = estado_atual
       OR (indice > 0 AND data_movimento = data_anterior AND movimento."aplicadaEm" = aplicado_anterior) THEN
      RETURN 'A_CONFERIR';
    END IF;
    IF data_movimento < ((ativada_em AT TIME ZONE 'UTC') AT TIME ZONE movimento.fuso)::date THEN
      RETURN 'A_CONFERIR';
    END IF;
    estado_atual := movimento.estado;
    data_aula := ((instante AT TIME ZONE 'UTC') AT TIME ZONE movimento.fuso)::date;
    IF data_movimento <= data_aula THEN estado_na_aula := movimento.estado; END IF;
    indice := indice + 1;
    data_anterior := data_movimento;
    aplicado_anterior := movimento."aplicadaEm";
  END LOOP;
  IF estado_atual <> status_conferido THEN RETURN 'A_CONFERIR'; END IF;
  RETURN estado_na_aula;
EXCEPTION WHEN OTHERS THEN
  RETURN 'A_CONFERIR';
END $$;

CREATE FUNCTION conferir_situacao_contratual_realizacao_recuperacao()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE plano_id TEXT; situacao TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT p.id INTO plano_id
    FROM "ItemReservaTentativaRecuperacao" i
    JOIN "ReservaTentativaRecuperacao" r ON r.id = i."reservaId"
    JOIN "PropostaPlanoRecuperacao" p ON p.id = r."propostaId"
    WHERE i.id = NEW."itemReservaId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Fonte da realização de recuperação não encontrada'; END IF;
  PERFORM m.id FROM "Matricula" m JOIN "PropostaPlanoRecuperacao" p ON p."matriculaId" = m.id
    WHERE p.id = plano_id FOR UPDATE OF m;
  SELECT situacao_matricula_no_instante(p."matriculaId", NEW."realizadaEm") INTO situacao
    FROM "PropostaPlanoRecuperacao" p WHERE p.id = plano_id;
  IF NEW."autorizacaoEspecialId" IS NULL AND situacao <> 'ATIVA' THEN
    RAISE EXCEPTION 'Realização sem autorização especial exige matrícula ativa na data';
  END IF;
  IF NEW."autorizacaoEspecialId" IS NOT NULL AND situacao NOT IN ('PAUSADA', 'ENCERRADA') THEN
    RAISE EXCEPTION 'Histórico contratual deve comprovar matrícula pausada ou encerrada na data da realização autorizada';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER conferir_situacao_contratual_realizacao_recuperacao
BEFORE INSERT ON "RealizacaoRecuperacao"
FOR EACH ROW EXECUTE FUNCTION conferir_situacao_contratual_realizacao_recuperacao();
