ALTER TABLE "AulaDiario" ALTER COLUMN "turmaId" DROP NOT NULL;
ALTER TABLE "AulaDiario" ADD CONSTRAINT diario_contexto_obrigatorio CHECK ("turmaId" IS NOT NULL OR "encontroId" IS NOT NULL);

CREATE FUNCTION conferir_contexto_diario() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e "EncontroAgenda";
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW."turmaId" IS DISTINCT FROM OLD."turmaId" OR NEW."encontroId" IS DISTINCT FROM OLD."encontroId" OR NEW."professorId" IS DISTINCT FROM OLD."professorId" OR NEW."ocorridaEm" IS DISTINCT FROM OLD."ocorridaEm") THEN
    RAISE EXCEPTION 'Contexto e autoria do diário são preservados';
  END IF;
  IF NEW."encontroId" IS NOT NULL THEN
    SELECT * INTO e FROM "EncontroAgenda" WHERE id = NEW."encontroId" FOR SHARE;
    IF NOT FOUND OR e."turmaId" IS DISTINCT FROM NEW."turmaId" OR e.inicio IS DISTINCT FROM NEW."ocorridaEm" THEN
      RAISE EXCEPTION 'Diário incompatível com o encontro';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER conferir_contexto_diario BEFORE INSERT OR UPDATE ON "AulaDiario" FOR EACH ROW EXECUTE FUNCTION conferir_contexto_diario();
