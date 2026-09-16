-- 216: Q116. Proposta e decisão são fatos separados; não cancelam processo nem
-- liberam o envio substituto. Intenção/prova externa serão integradas depois.
CREATE TABLE "PropostaSubstituicaoContratual" (
  id TEXT PRIMARY KEY,
  "matriculaId" TEXT NOT NULL REFERENCES "Matricula"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "processoFonteId" TEXT NOT NULL REFERENCES "ProcessoAssinaturaContratual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "referenciaExternaFonte" TEXT NOT NULL,
  "artefatoFonteId" TEXT NOT NULL REFERENCES "ArtefatoContratual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "artefatoSubstitutoId" TEXT NOT NULL REFERENCES "ArtefatoContratual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "conferenciaSubstitutoId" TEXT NOT NULL REFERENCES "ConferenciaAssinaturaContratual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  versao INTEGER NOT NULL CHECK (versao > 0),
  "revisaoFonteHash" TEXT NOT NULL CHECK ("revisaoFonteHash" ~ '^[a-f0-9]{64}$'),
  "revisaoSubstitutoHash" TEXT NOT NULL CHECK ("revisaoSubstitutoHash" ~ '^[a-f0-9]{64}$'),
  "preparadaPorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  motivo TEXT NOT NULL CHECK (length(btrim(motivo)) BETWEEN 5 AND 4000 AND motivo = btrim(motivo)),
  diferencas JSONB NOT NULL CHECK (jsonb_typeof(diferencas) = 'object' AND diferencas <> '{}'::jsonb),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  "chaveIdempotencia" TEXT NOT NULL CHECK (length(btrim("chaveIdempotencia")) BETWEEN 8 AND 200 AND "chaveIdempotencia" = btrim("chaveIdempotencia")),
  "entradaHash" TEXT NOT NULL CHECK ("entradaHash" ~ '^[a-f0-9]{64}$'),
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  CHECK ("artefatoFonteId" <> "artefatoSubstitutoId"),
  CHECK (length(btrim("referenciaExternaFonte")) BETWEEN 1 AND 200 AND "referenciaExternaFonte" = btrim("referenciaExternaFonte"))
);
CREATE UNIQUE INDEX "substituicao_contratual_autor_chave_key"
  ON "PropostaSubstituicaoContratual"("preparadaPorId", "chaveIdempotencia");
CREATE UNIQUE INDEX "PropostaSubstituicaoContratual_processoFonteId_versao_key"
  ON "PropostaSubstituicaoContratual"("processoFonteId", versao);
CREATE INDEX "PropostaSubstituicaoContratual_matriculaId_criadaEm_idx"
  ON "PropostaSubstituicaoContratual"("matriculaId", "criadaEm");

CREATE TABLE "DecisaoSubstituicaoContratual" (
  id TEXT PRIMARY KEY,
  "propostaId" TEXT NOT NULL REFERENCES "PropostaSubstituicaoContratual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "decisorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  aprovada BOOLEAN NOT NULL,
  motivo TEXT NOT NULL CHECK (length(btrim(motivo)) BETWEEN 5 AND 4000 AND motivo = btrim(motivo)),
  "propostaHash" TEXT NOT NULL CHECK ("propostaHash" ~ '^[a-f0-9]{64}$'),
  "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
);
CREATE UNIQUE INDEX "DecisaoSubstituicaoContratual_propostaId_key" ON "DecisaoSubstituicaoContratual"("propostaId");

-- Conferência de identidade da fonte sob a mesma ordem de locks da operação.
-- Hashes das conferências preservadas não substituem a revisão atual no serviço.
CREATE FUNCTION conferir_fonte_substituicao_216(p "PropostaSubstituicaoContratual")
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE fonte "ProcessoAssinaturaContratual"%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  PERFORM id FROM "Matricula" WHERE id = p."matriculaId" FOR UPDATE;
  SELECT * INTO fonte FROM "ProcessoAssinaturaContratual" WHERE id = p."processoFonteId" FOR UPDATE;
  IF NOT FOUND OR fonte."matriculaId" IS DISTINCT FROM p."matriculaId"
    OR fonte."artefatoId" IS DISTINCT FROM p."artefatoFonteId"
    OR fonte."referenciaExterna" IS DISTINCT FROM p."referenciaExternaFonte"
    OR fonte.estado::text <> 'ENVIADO' THEN
    RAISE EXCEPTION 'Substituição exige processo enviado da mesma matrícula e original';
  END IF;
  IF EXISTS (SELECT 1 FROM "ConclusaoAssinaturaContratual" WHERE "processoId" = fonte.id) THEN
    RAISE EXCEPTION 'Contrato totalmente assinado exige aditivo Q117';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "ArtefatoContratual" a
    JOIN "PreviaDocumentoContratual" previa ON previa.id = a."previaId"
    JOIN "ConferenciaAssinaturaContratual" c ON c."artefatoId" = a.id
    WHERE a.id = p."artefatoSubstitutoId" AND previa."matriculaId" = p."matriculaId"
      AND c.id = p."conferenciaSubstitutoId" AND c."revisaoHash" = p."revisaoSubstitutoHash"
  ) OR NOT EXISTS (
    SELECT 1 FROM "ConferenciaAssinaturaContratual" c
    WHERE c.id = fonte."conferenciaId" AND c."artefatoId" = p."artefatoFonteId" AND c."revisaoHash" = p."revisaoFonteHash"
  ) THEN RAISE EXCEPTION 'Originais e conferências incompatíveis com a substituição'; END IF;
END;
$$;

CREATE FUNCTION validar_proposta_substituicao_216() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE ator "Usuario"%ROWTYPE; ultima INTEGER;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Proposta de substituição contratual é imutável'; END IF;
  IF (NEW.snapshot @> jsonb_build_object(
    'matriculaId', NEW."matriculaId", 'processoFonteId', NEW."processoFonteId",
    'referenciaExternaFonte', NEW."referenciaExternaFonte", 'artefatoFonteId', NEW."artefatoFonteId",
    'artefatoSubstitutoId', NEW."artefatoSubstitutoId", 'conferenciaSubstitutoId', NEW."conferenciaSubstitutoId",
    'versao', NEW.versao, 'revisaoFonteHash', NEW."revisaoFonteHash",
    'revisaoSubstitutoHash', NEW."revisaoSubstitutoHash", 'preparadaPorId', NEW."preparadaPorId",
    'motivo', NEW.motivo, 'diferencas', NEW.diferencas
  )) IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Snapshot não corresponde à proposta de substituição'; END IF;
  PERFORM conferir_fonte_substituicao_216(NEW);
  SELECT * INTO ator FROM "Usuario" WHERE id = NEW."preparadaPorId" FOR SHARE;
  IF NOT FOUND OR NOT ator.ativo OR NOT (ator.papeis && ARRAY['SECRETARIA_ACADEMICA','ADMINISTRADOR']::"Papel"[]) THEN
    RAISE EXCEPTION 'Preparação exige Secretaria ou Administração ativa';
  END IF;
  SELECT COALESCE(MAX(versao), 0) INTO ultima FROM "PropostaSubstituicaoContratual" WHERE "processoFonteId" = NEW."processoFonteId";
  IF NEW.versao <> ultima + 1 THEN RAISE EXCEPTION 'Versão da proposta de substituição mudou'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validar_proposta_substituicao_216 BEFORE INSERT OR UPDATE OR DELETE
  ON "PropostaSubstituicaoContratual" FOR EACH ROW EXECUTE FUNCTION validar_proposta_substituicao_216();

CREATE FUNCTION validar_decisao_substituicao_216() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaSubstituicaoContratual"%ROWTYPE; ator "Usuario"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisão de substituição contratual é imutável'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO proposta FROM "PropostaSubstituicaoContratual" WHERE id = NEW."propostaId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de substituição inexistente'; END IF;
  PERFORM id FROM "Matricula" WHERE id = proposta."matriculaId" FOR UPDATE;
  PERFORM id FROM "ProcessoAssinaturaContratual" WHERE id = proposta."processoFonteId" FOR UPDATE;
  SELECT * INTO ator FROM "Usuario" WHERE id = NEW."decisorId" FOR SHARE;
  IF NOT FOUND OR NOT ator.ativo OR NOT ('ADMINISTRADOR'::"Papel" = ANY(ator.papeis))
    OR NEW."decisorId" = proposta."preparadaPorId" THEN
    RAISE EXCEPTION 'Decisão exige outro administrador ativo';
  END IF;
  IF NEW."propostaHash" IS DISTINCT FROM proposta."entradaHash" THEN RAISE EXCEPTION 'Decisão não corresponde à proposta exata'; END IF;
  IF NEW.aprovada THEN
    IF EXISTS (SELECT 1 FROM "PropostaSubstituicaoContratual" p WHERE p."processoFonteId" = proposta."processoFonteId" AND p.versao > proposta.versao) THEN
      RAISE EXCEPTION 'Existe proposta de substituição mais recente';
    END IF;
    PERFORM conferir_fonte_substituicao_216(proposta);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validar_decisao_substituicao_216 BEFORE INSERT OR UPDATE OR DELETE
  ON "DecisaoSubstituicaoContratual" FOR EACH ROW EXECUTE FUNCTION validar_decisao_substituicao_216();
