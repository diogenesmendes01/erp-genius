CREATE OR REPLACE FUNCTION conferir_ocorrencia_particular() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e "EncontroAgenda"%ROWTYPE; u "Usuario"%ROWTYPE; anterior integer;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Ocorrências particulares devem ser preservadas.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO e FROM "EncontroAgenda" WHERE id = NEW."encontroId" FOR UPDATE;
  SELECT * INTO u FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
  IF e."matriculaId" IS DISTINCT FROM NEW."matriculaId" OR e."turmaId" IS NOT NULL
    OR e."professorId" IS DISTINCT FROM NEW."autorId" OR u.ativo IS DISTINCT FROM true
    OR NOT ('PROFESSOR' = ANY(u.papeis)) THEN RAISE EXCEPTION 'Sem atribuição docente para esta particular.'; END IF;
  IF e.inicio <> NEW.inicio OR e.fim <> NEW.fim THEN RAISE EXCEPTION 'A agenda mudou.'; END IF;
  NEW."criadoEm" := clock_timestamp() AT TIME ZONE 'UTC';
  IF NEW."comunicadoEm" > NEW."criadoEm" THEN RAISE EXCEPTION 'Data de ocorrência inválida.'; END IF;
  IF NEW.tipo IN ('REALIZADA', 'FALTA_ALUNO') THEN
    IF e.status NOT IN ('PREVISTO', 'MINISTRADO') OR NEW.fim > NEW."criadoEm" THEN RAISE EXCEPTION 'Aguarde o término do encontro previsto.'; END IF;
  ELSE
    IF e.status <> 'CANCELADO' OR NOT EXISTS (
      SELECT 1 FROM "DecisaoCancelamentoParticular" d JOIN "PropostaCancelamentoParticular" p ON p.id = d."propostaId"
      WHERE p."encontroId" = e.id AND d.aprovada
    ) THEN RAISE EXCEPTION 'Cancelamento precisa de aprovação pedagógica.'; END IF;
  END IF;
  SELECT COALESCE(MAX(versao), 0) INTO anterior FROM "OcorrenciaParticular" WHERE "encontroId" = e.id;
  IF NEW.versao <> anterior + 1 THEN RAISE EXCEPTION 'Versão da ocorrência mudou.'; END IF;
  RETURN NEW;
END $$;
