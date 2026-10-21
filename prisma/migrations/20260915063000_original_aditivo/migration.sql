-- Q117: preserva o original do aditivo. Este artefato ainda não inicia assinatura nem aplicação.
CREATE TABLE "ArtefatoAditivoContratual" (
  id TEXT PRIMARY KEY,
  "propostaId" TEXT NOT NULL REFERENCES "PropostaAditivoContratual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "conferenciaId" TEXT NOT NULL REFERENCES "ConferenciaParticipantesAditivo"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "autorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  pdf BYTEA NOT NULL CHECK (octet_length(pdf) BETWEEN 5 AND 10485760),
  "pdfHash" TEXT NOT NULL CHECK ("pdfHash" ~ '^[a-f0-9]{64}$'),
  "baseHash" TEXT NOT NULL CHECK ("baseHash" ~ '^[a-f0-9]{64}$'),
  gerador JSONB NOT NULL CHECK (jsonb_typeof(gerador) = 'object'),
  paginas INTEGER NOT NULL CHECK (paginas > 0 AND paginas <= 10000),
  motivo TEXT NOT NULL CHECK (length(btrim(motivo)) BETWEEN 5 AND 2000 AND motivo = btrim(motivo)),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
);
CREATE UNIQUE INDEX "ArtefatoAditivoContratual_conferenciaId_key" ON "ArtefatoAditivoContratual"("conferenciaId");
CREATE INDEX "ArtefatoAditivoContratual_propostaId_criadoEm_idx" ON "ArtefatoAditivoContratual"("propostaId", "criadoEm");

CREATE FUNCTION validar_artefato_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaAditivoContratual"%ROWTYPE; conferencia "ConferenciaParticipantesAditivo"%ROWTYPE;
        decisao "DecisaoAditivoContratual"%ROWTYPE; conclusao "ConclusaoAssinaturaContratual"%ROWTYPE; ator "Usuario"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Original de aditivo contratual é imutável'; END IF;
  -- Ordem global: calendário, matrícula, processo fonte, usuário.
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO proposta FROM "PropostaAditivoContratual" WHERE id = NEW."propostaId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de aditivo inexistente'; END IF;
  PERFORM id FROM "Matricula" WHERE id = proposta."matriculaId" FOR UPDATE;
  SELECT * INTO conclusao FROM "ConclusaoAssinaturaContratual" WHERE id = proposta."conclusaoOriginalId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conclusão original indisponível'; END IF;
  PERFORM id FROM "ProcessoAssinaturaContratual" WHERE id = conclusao."processoId" FOR UPDATE;
  SELECT * INTO conferencia FROM "ConferenciaParticipantesAditivo" WHERE id = NEW."conferenciaId" FOR SHARE;
  IF NOT FOUND OR conferencia."propostaId" IS DISTINCT FROM proposta.id THEN RAISE EXCEPTION 'Conferência não corresponde à proposta'; END IF;
  SELECT * INTO decisao FROM "DecisaoAditivoContratual" WHERE id = conferencia."decisaoId" FOR SHARE;
  IF NOT FOUND OR NOT decisao.aprovada OR decisao."propostaId" IS DISTINCT FROM proposta.id
    OR decisao."propostaHash" IS DISTINCT FROM proposta."entradaHash" OR conferencia."propostaHash" IS DISTINCT FROM proposta."entradaHash" THEN
    RAISE EXCEPTION 'Original exige proposta aprovada e conferência da versão exata';
  END IF;
  IF EXISTS (SELECT 1 FROM "ConferenciaParticipantesAditivo" nova WHERE nova."propostaId" = proposta.id AND nova.versao > conferencia.versao)
    OR EXISTS (SELECT 1 FROM "PropostaAditivoContratual" nova WHERE nova."matriculaId" = proposta."matriculaId" AND nova.versao > proposta.versao) THEN
    RAISE EXCEPTION 'A conferência ou proposta de aditivo foi superada';
  END IF;
  PERFORM conferir_fonte_aditivo_117(proposta);
  IF substring(NEW.pdf FROM 1 FOR 5) <> decode('255044462d', 'hex')
    OR encode(sha256(NEW.pdf), 'hex') IS DISTINCT FROM NEW."pdfHash" THEN
    RAISE EXCEPTION 'Original de aditivo sem PDF íntegro';
  END IF;
  IF NEW."baseHash" IS DISTINCT FROM encode(sha256(convert_to(format('{"conferenciaHash":"%s","propostaHash":"%s"}', conferencia."revisaoHash", proposta."entradaHash"), 'UTF8')), 'hex') THEN
    RAISE EXCEPTION 'Hash de base não corresponde à proposta e conferência';
  END IF;
  SELECT * INTO ator FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
  IF NOT FOUND OR NOT ator.ativo OR NOT (ator.papeis && ARRAY['SECRETARIA_ACADEMICA','ADMINISTRADOR']::"Papel"[]) THEN
    RAISE EXCEPTION 'Preservação exige Secretaria ou Administração ativa';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validar_artefato_aditivo_117 BEFORE INSERT OR UPDATE OR DELETE ON "ArtefatoAditivoContratual"
FOR EACH ROW EXECUTE FUNCTION validar_artefato_aditivo_117();
