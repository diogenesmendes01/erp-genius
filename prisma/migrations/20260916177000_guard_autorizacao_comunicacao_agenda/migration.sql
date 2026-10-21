ALTER TABLE "AutorizacaoComunicacaoAcademica" ADD COLUMN "motivoRevogacao" TEXT;

CREATE OR REPLACE FUNCTION "guard_autorizacao_comunicacao_academica"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Autorização acadêmica não pode ser apagada';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF btrim(NEW.evidencia) = '' THEN
      RAISE EXCEPTION 'Autorização acadêmica exige evidência';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM "Matricula" m
      JOIN "AlunoResponsavel" ar ON ar."alunoId" = m."alunoId"
      WHERE m.id = NEW."matriculaId"
        AND ar."responsavelId" = NEW."responsavelId"
        AND ar.papel = 'PEDAGOGICO'::"PapelResponsavel"
    ) THEN
      RAISE EXCEPTION 'Responsável pedagógico não pertence à matrícula';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM "Usuario" u
      WHERE u.id = NEW."autorizadaPorId"
        AND u.ativo
        AND u.papeis && ARRAY['ADMINISTRADOR'::"Papel", 'SECRETARIA_ACADEMICA'::"Papel"]
    ) THEN
      RAISE EXCEPTION 'Autor da autorização acadêmica não possui papel ativo';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW."matriculaId" IS DISTINCT FROM OLD."matriculaId"
    OR NEW."responsavelId" IS DISTINCT FROM OLD."responsavelId"
    OR NEW."autorizadaPorId" IS DISTINCT FROM OLD."autorizadaPorId"
    OR NEW.evidencia IS DISTINCT FROM OLD.evidencia
    OR NEW."vigenteEm" IS DISTINCT FROM OLD."vigenteEm" THEN
    RAISE EXCEPTION 'Autorização acadêmica é imutável';
  END IF;
  IF OLD."revogadaEm" IS NOT NULL
    OR NEW."revogadaEm" IS NULL
    OR NEW."revogadaPorId" IS NULL
    OR NEW."motivoRevogacao" IS NULL
    OR btrim(NEW."motivoRevogacao") = '' THEN
    RAISE EXCEPTION 'Revogação acadêmica inválida';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Usuario" u
    WHERE u.id = NEW."revogadaPorId"
      AND u.ativo
      AND u.papeis && ARRAY['ADMINISTRADOR'::"Papel", 'SECRETARIA_ACADEMICA'::"Papel"]
  ) THEN
    RAISE EXCEPTION 'Revogador da autorização acadêmica não possui papel ativo';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "guard_autorizacao_comunicacao_academica"
  BEFORE INSERT OR UPDATE OR DELETE ON "AutorizacaoComunicacaoAcademica"
  FOR EACH ROW EXECUTE FUNCTION "guard_autorizacao_comunicacao_academica"();

CREATE OR REPLACE FUNCTION "guard_aviso_autorizacao_academica"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."destinatarioResponsavelId" IS NULL AND NEW."autorizacaoComunicacaoAcademicaId" IS NOT NULL THEN
    RAISE EXCEPTION 'Autorização acadêmica exige destinatário responsável';
  END IF;
  IF NEW."destinatarioResponsavelId" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM "AutorizacaoComunicacaoAcademica" a
    WHERE a.id = NEW."autorizacaoComunicacaoAcademicaId"
      AND a."matriculaId" = NEW."matriculaId"
      AND a."responsavelId" = NEW."destinatarioResponsavelId"
      AND a."vigenteEm" <= CURRENT_TIMESTAMP
      AND a."revogadaEm" IS NULL
  ) THEN
    RAISE EXCEPTION 'Autorização não corresponde ao aviso';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "guard_aviso_autorizacao_academica"
  BEFORE INSERT ON "AvisoAlteracaoAgenda"
  FOR EACH ROW EXECUTE FUNCTION "guard_aviso_autorizacao_academica"();