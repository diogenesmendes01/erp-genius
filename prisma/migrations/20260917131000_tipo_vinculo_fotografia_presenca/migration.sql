-- M01/210: conserva a guarda 208, tipando os compostos usados pelo helper.
BEGIN;
CREATE OR REPLACE FUNCTION "m01_presenca_historica_fotografia_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE aula "AulaDiario"; aloc "AlocacaoTurma";
BEGIN
  IF NOT (TG_OP='INSERT' OR NEW.status IN ('APROVADA','APLICADA','PENDENCIA_CORRECAO')) THEN RETURN NEW; END IF;
  SELECT * INTO aula FROM "AulaDiario" WHERE id=NEW."aulaId";
  SELECT * INTO aloc FROM "AlocacaoTurma" WHERE id=NEW.snapshot->'alocacao'->>'id';
  IF aula.id IS NULL OR aloc.id IS NULL
    OR NEW.snapshot->'aula'->>'id' IS DISTINCT FROM aula.id
    OR (NEW.snapshot->'aula'->>'ocorridaEm')::timestamptz IS DISTINCT FROM (aula."ocorridaEm" AT TIME ZONE 'UTC')
    OR NEW.snapshot->'aula'->>'turmaId' IS DISTINCT FROM aula."turmaId"
    OR aloc."matriculaId" IS DISTINCT FROM NEW."matriculaId"
    OR aloc."alunoId" IS DISTINCT FROM NEW.snapshot->'aluno'->>'id'
    OR aloc."turmaId" IS DISTINCT FROM aula."turmaId"
    OR NOT alocacao_cobre_instante(aloc,aula."ocorridaEm" AT TIME ZONE 'UTC') THEN
    RAISE EXCEPTION 'Aula ou vínculo histórico mudou; crie nova proposta M01';
  END IF;
  RETURN NEW;
END $$;
COMMIT;
