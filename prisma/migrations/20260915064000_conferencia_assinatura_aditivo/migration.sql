-- Q117: conferência interna do original preservado. Não cria envio ou aplicação.
CREATE TABLE "ConferenciaAssinaturaAditivo" (
  id TEXT PRIMARY KEY,
  "artefatoId" TEXT NOT NULL REFERENCES "ArtefatoAditivoContratual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "autorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "revisaoHash" TEXT NOT NULL CHECK ("revisaoHash" ~ '^[a-f0-9]{64}$'),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  motivo TEXT NOT NULL CHECK (length(btrim(motivo)) BETWEEN 5 AND 2000 AND motivo = btrim(motivo)),
  "chaveIdempotencia" TEXT NOT NULL CHECK (length(btrim("chaveIdempotencia")) BETWEEN 8 AND 100 AND "chaveIdempotencia" = btrim("chaveIdempotencia")),
  "entradaHash" TEXT NOT NULL CHECK ("entradaHash" ~ '^[a-f0-9]{64}$'),
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
);
CREATE UNIQUE INDEX "ConferenciaAssinaturaAditivo_autorId_chaveIdempotencia_key" ON "ConferenciaAssinaturaAditivo"("autorId", "chaveIdempotencia");
CREATE INDEX "ConferenciaAssinaturaAditivo_artefatoId_criadoEm_idx" ON "ConferenciaAssinaturaAditivo"("artefatoId", "criadaEm");

CREATE FUNCTION validar_conferencia_assinatura_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE artefato "ArtefatoAditivoContratual"%ROWTYPE; proposta "PropostaAditivoContratual"%ROWTYPE;
        participantes "ConferenciaParticipantesAditivo"%ROWTYPE; decisao "DecisaoAditivoContratual"%ROWTYPE; ator "Usuario"%ROWTYPE;
        participantes_projetados JSONB;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Conferência interna de aditivo é imutável'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO artefato FROM "ArtefatoAditivoContratual" WHERE id = NEW."artefatoId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Original de aditivo inexistente'; END IF;
  SELECT * INTO proposta FROM "PropostaAditivoContratual" WHERE id = artefato."propostaId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de aditivo inexistente'; END IF;
  PERFORM id FROM "Matricula" WHERE id = proposta."matriculaId" FOR UPDATE;
  PERFORM id FROM "ProcessoAssinaturaContratual" WHERE id = (SELECT "processoId" FROM "ConclusaoAssinaturaContratual" WHERE id = proposta."conclusaoOriginalId") FOR UPDATE;
  SELECT * INTO participantes FROM "ConferenciaParticipantesAditivo" WHERE id = artefato."conferenciaId" FOR SHARE;
  SELECT * INTO decisao FROM "DecisaoAditivoContratual" WHERE id = participantes."decisaoId" FOR SHARE;
  IF NOT FOUND OR participantes."propostaId" IS DISTINCT FROM proposta.id OR NOT decisao.aprovada
    OR decisao."propostaHash" IS DISTINCT FROM proposta."entradaHash" OR participantes."propostaHash" IS DISTINCT FROM proposta."entradaHash" THEN
    RAISE EXCEPTION 'Conferência exige artefato da proposta aprovada e exata';
  END IF;
  IF EXISTS (SELECT 1 FROM "PropostaAditivoContratual" n WHERE n."matriculaId" = proposta."matriculaId" AND n.versao > proposta.versao)
    OR EXISTS (SELECT 1 FROM "ConferenciaParticipantesAditivo" n WHERE n."propostaId" = proposta.id AND n.versao > participantes.versao) THEN
    RAISE EXCEPTION 'A proposta ou os participantes foram superados';
  END IF;
  PERFORM conferir_fonte_aditivo_117(proposta);
  IF encode(sha256(artefato.pdf), 'hex') IS DISTINCT FROM artefato."pdfHash" OR substring(artefato.pdf FROM 1 FOR 5) <> decode('255044462d', 'hex') THEN
    RAISE EXCEPTION 'Original de aditivo sem integridade';
  END IF;
  IF artefato."baseHash" IS DISTINCT FROM encode(sha256(convert_to(format('{"conferenciaHash":"%s","propostaHash":"%s"}', participantes."revisaoHash", proposta."entradaHash"), 'UTF8')), 'hex') THEN
    RAISE EXCEPTION 'Base do artefato divergente';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('papel', item->'papel', 'etapa', item->'etapa', 'identidade', item->'identidade') ORDER BY ordem), '[]'::jsonb)
    INTO participantes_projetados
    FROM jsonb_array_elements(participantes.snapshot->'participantes') WITH ORDINALITY AS p(item, ordem);
  IF NOT (NEW.snapshot ?& ARRAY['propostaId','artefatoId','conferenciaId','propostaHash','conferenciaHash','pdfHash','baseHash','decisaoId','modelo','ambiente','participantes'])
    OR NEW.snapshot->>'propostaId' IS DISTINCT FROM proposta.id OR NEW.snapshot->>'artefatoId' IS DISTINCT FROM artefato.id
    OR NEW.snapshot->>'conferenciaId' IS DISTINCT FROM participantes.id OR NEW.snapshot->>'propostaHash' IS DISTINCT FROM proposta."entradaHash"
    OR NEW.snapshot->>'conferenciaHash' IS DISTINCT FROM participantes."revisaoHash" OR NEW.snapshot->>'pdfHash' IS DISTINCT FROM artefato."pdfHash"
    OR NEW.snapshot->>'baseHash' IS DISTINCT FROM artefato."baseHash" OR NEW.snapshot->>'decisaoId' IS DISTINCT FROM decisao.id
    OR NEW.snapshot->>'versaoProposta' IS DISTINCT FROM proposta.versao::text
    OR NEW.snapshot->>'conferenciaVersao' IS DISTINCT FROM participantes.versao::text
    OR NEW.snapshot->'modelo' IS DISTINCT FROM jsonb_build_object('codigo', proposta.snapshot->'base'->'modeloCodigo', 'versao', proposta.snapshot->'base'->'modeloVersao')
    OR NEW.snapshot->>'ambiente' IS DISTINCT FROM proposta.snapshot->'base'->>'ambiente'
    OR NEW.snapshot->>'vigenciaInicio' IS DISTINCT FROM proposta.snapshot->>'vigenciaInicio'
    OR NEW.snapshot->'participantes' IS DISTINCT FROM participantes_projetados THEN
    RAISE EXCEPTION 'Snapshot da conferência interna não corresponde ao artefato';
  END IF;
  SELECT * INTO ator FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
  IF NOT FOUND OR NOT ator.ativo OR NOT (ator.papeis && ARRAY['SECRETARIA_ACADEMICA','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Conferência exige Secretaria ou Administração ativa'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validar_conferencia_assinatura_aditivo_117 BEFORE INSERT OR UPDATE OR DELETE ON "ConferenciaAssinaturaAditivo"
FOR EACH ROW EXECUTE FUNCTION validar_conferencia_assinatura_aditivo_117();
