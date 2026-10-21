-- 217: intenção e evidências Q116. Não modifica o estado do processo externo.
CREATE TABLE "IntencaoCancelamentoAssinatura" (
  id TEXT PRIMARY KEY,
  "processoId" TEXT NOT NULL REFERENCES "ProcessoAssinaturaContratual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "propostaId" TEXT NOT NULL REFERENCES "PropostaSubstituicaoContratual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "decisaoId" TEXT NOT NULL REFERENCES "DecisaoSubstituicaoContratual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "executorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "propostaHash" TEXT NOT NULL CHECK ("propostaHash" ~ '^[a-f0-9]{64}$'),
  "referenciaExterna" TEXT NOT NULL CHECK (length("referenciaExterna") BETWEEN 1 AND 200 AND "referenciaExterna" = btrim("referenciaExterna")),
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
);
CREATE UNIQUE INDEX "IntencaoCancelamentoAssinatura_processoId_key" ON "IntencaoCancelamentoAssinatura"("processoId");
CREATE UNIQUE INDEX "IntencaoCancelamentoAssinatura_propostaId_key" ON "IntencaoCancelamentoAssinatura"("propostaId");
CREATE UNIQUE INDEX "IntencaoCancelamentoAssinatura_decisaoId_key" ON "IntencaoCancelamentoAssinatura"("decisaoId");
CREATE TABLE "ObservacaoCancelamentoAssinatura" (
  id TEXT PRIMARY KEY,
  "intencaoId" TEXT NOT NULL REFERENCES "IntencaoCancelamentoAssinatura"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  chave TEXT NOT NULL CHECK (length(chave) BETWEEN 8 AND 200 AND chave = btrim(chave)),
  resultado TEXT NOT NULL CHECK (resultado IN ('INCERTO', 'CONFIRMADO')),
  "referenciaExterna" TEXT NOT NULL,
  "evidenciaHash" TEXT NOT NULL CHECK ("evidenciaHash" ~ '^[a-f0-9]{64}$'),
  "registradaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
);
CREATE UNIQUE INDEX "ObservacaoCancelamentoAssinatura_intencaoId_chave_key" ON "ObservacaoCancelamentoAssinatura"("intencaoId", chave);

CREATE FUNCTION validar_intencao_cancelamento_217() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaSubstituicaoContratual"%ROWTYPE; decisao "DecisaoSubstituicaoContratual"%ROWTYPE; ator "Usuario"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Intenção de cancelamento é imutável'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO proposta FROM "PropostaSubstituicaoContratual" WHERE id = NEW."propostaId";
  IF NOT FOUND OR proposta."processoFonteId" <> NEW."processoId" OR proposta."entradaHash" <> NEW."propostaHash"
    OR proposta."referenciaExternaFonte" <> NEW."referenciaExterna" THEN RAISE EXCEPTION 'Intenção não corresponde à proposta e ao processo'; END IF;
  PERFORM conferir_fonte_substituicao_216(proposta);
  SELECT * INTO decisao FROM "DecisaoSubstituicaoContratual" WHERE id = NEW."decisaoId";
  IF NOT FOUND OR NOT decisao.aprovada OR decisao."propostaId" <> proposta.id
    OR decisao."propostaHash" <> proposta."entradaHash" OR decisao."decisorId" = proposta."preparadaPorId" THEN
    RAISE EXCEPTION 'Cancelamento exige decisão independente aprovada da proposta exata';
  END IF;
  IF EXISTS (SELECT 1 FROM "PropostaSubstituicaoContratual" p WHERE p."processoFonteId" = proposta."processoFonteId" AND p.versao > proposta.versao) THEN
    RAISE EXCEPTION 'Existe proposta mais recente para este processo';
  END IF;
  SELECT * INTO ator FROM "Usuario" WHERE id = NEW."executorId" FOR SHARE;
  IF NOT FOUND OR NOT ator.ativo OR NOT (ator.papeis && ARRAY['SECRETARIA_ACADEMICA', 'ADMINISTRADOR']::"Papel"[]) THEN
    RAISE EXCEPTION 'Cancelamento exige Secretaria ou Administração ativa';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER validar_intencao_cancelamento_217 BEFORE INSERT OR UPDATE OR DELETE ON "IntencaoCancelamentoAssinatura"
FOR EACH ROW EXECUTE FUNCTION validar_intencao_cancelamento_217();

CREATE FUNCTION validar_observacao_cancelamento_217() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE intencao "IntencaoCancelamentoAssinatura"%ROWTYPE; matricula TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Observação de cancelamento é imutável'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO intencao FROM "IntencaoCancelamentoAssinatura" WHERE id = NEW."intencaoId";
  IF NOT FOUND OR NEW."referenciaExterna" <> intencao."referenciaExterna" THEN RAISE EXCEPTION 'Observação não corresponde à intenção de cancelamento'; END IF;
  SELECT "matriculaId" INTO matricula FROM "ProcessoAssinaturaContratual" WHERE id = intencao."processoId";
  PERFORM id FROM "Matricula" WHERE id = matricula FOR UPDATE;
  PERFORM id FROM "ProcessoAssinaturaContratual" WHERE id = intencao."processoId" FOR UPDATE;
  -- Uma conclusão concorrente não apaga nem impede preservar o fato externo.
  RETURN NEW;
END; $$;
CREATE TRIGGER validar_observacao_cancelamento_217 BEFORE INSERT OR UPDATE OR DELETE ON "ObservacaoCancelamentoAssinatura"
FOR EACH ROW EXECUTE FUNCTION validar_observacao_cancelamento_217();
