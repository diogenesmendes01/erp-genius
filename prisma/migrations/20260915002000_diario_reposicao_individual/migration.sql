-- Diário de REPOSICAO é a única exceção acadêmica ao guard de AULA. Mantém
-- `RECUPERACAO` e todos os consumidores financeiro/comercial fora do diário.
CREATE OR REPLACE FUNCTION conferir_contexto_diario() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e "EncontroAgenda"%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW."turmaId" IS DISTINCT FROM OLD."turmaId" OR NEW."encontroId" IS DISTINCT FROM OLD."encontroId" OR NEW."professorId" IS DISTINCT FROM OLD."professorId" OR NEW."ocorridaEm" IS DISTINCT FROM OLD."ocorridaEm") THEN
    RAISE EXCEPTION 'Contexto e autoria do diário são preservados';
  END IF;
  IF NEW."encontroId" IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO e FROM "EncontroAgenda" WHERE id = NEW."encontroId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Diário incompatível com o encontro'; END IF;
  IF e.finalidade = 'REPOSICAO' THEN
    IF e."turmaId" IS NOT NULL OR e."matriculaId" IS NULL OR NEW."turmaId" IS NOT NULL OR e."professorId" IS DISTINCT FROM NEW."professorId" OR e.inicio IS DISTINCT FROM NEW."ocorridaEm" THEN
      RAISE EXCEPTION 'Diário de reposição exige encontro individual e docente responsável';
    END IF;
    RETURN NEW;
  END IF;
  IF e.finalidade <> 'AULA' OR e."turmaId" IS DISTINCT FROM NEW."turmaId" OR e.inicio IS DISTINCT FROM NEW."ocorridaEm" THEN
    RAISE EXCEPTION 'Diário incompatível com o encontro';
  END IF;
  RETURN NEW;
END $$;
