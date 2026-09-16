-- Q117: conferência interna posterior ao recebimento assinado; não aplica o aditivo.
CREATE TABLE "ConferenciaFinalAditivo" (
  id TEXT PRIMARY KEY,
  "conclusaoId" TEXT NOT NULL UNIQUE REFERENCES "ConclusaoAssinaturaAditivo"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "autorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "revisaoHash" TEXT NOT NULL CHECK ("revisaoHash" ~ '^[a-f0-9]{64}$'),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  motivo TEXT NOT NULL CHECK (length(btrim(motivo)) BETWEEN 5 AND 2000 AND motivo = btrim(motivo)),
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
);

CREATE FUNCTION validar_conferencia_final_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE conclusao "ConclusaoAssinaturaAditivo"%ROWTYPE; pe "ProcessoAssinaturaAditivo"%ROWTYPE;
        proposta "PropostaAditivoContratual"%ROWTYPE; artefato "ArtefatoAditivoContratual"%ROWTYPE;
        participantes "ConferenciaParticipantesAditivo"%ROWTYPE; assinatura "ConferenciaAssinaturaAditivo"%ROWTYPE;
        ator "Usuario"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Conferência final de aditivo é imutável'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO conclusao FROM "ConclusaoAssinaturaAditivo" WHERE id = NEW."conclusaoId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conclusão assinada de aditivo inexistente'; END IF;
  SELECT * INTO pe FROM "ProcessoAssinaturaAditivo" WHERE id = conclusao."processoId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Processo de assinatura de aditivo inexistente'; END IF;
  SELECT * INTO proposta FROM "PropostaAditivoContratual" WHERE id = pe."propostaId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de aditivo inexistente'; END IF;
  PERFORM id FROM "Matricula" WHERE id = proposta."matriculaId" FOR UPDATE;
  PERFORM id FROM "ProcessoAssinaturaAditivo" WHERE id = pe.id FOR UPDATE;
  SELECT * INTO artefato FROM "ArtefatoAditivoContratual" WHERE id = pe."artefatoId" FOR SHARE;
  SELECT * INTO assinatura FROM "ConferenciaAssinaturaAditivo" WHERE id = pe."conferenciaId" FOR SHARE;
  SELECT * INTO participantes FROM "ConferenciaParticipantesAditivo" WHERE id = artefato."conferenciaId" FOR SHARE;
  IF artefato."propostaId" IS DISTINCT FROM proposta.id OR assinatura."artefatoId" IS DISTINCT FROM artefato.id
    OR participantes."propostaId" IS DISTINCT FROM proposta.id OR pe.estado <> 'ENVIADO'
    OR pe."referenciaExterna" IS DISTINCT FROM conclusao."referenciaExterna" OR conclusao."originalHash" IS DISTINCT FROM artefato."pdfHash"
    OR encode(sha256(conclusao."pdfAssinado"), 'hex') IS DISTINCT FROM conclusao."pdfHash"
    OR encode(sha256(conclusao.evidencias), 'hex') IS DISTINCT FROM conclusao."evidenciasHash" THEN
    RAISE EXCEPTION 'Conclusão preservada não corresponde ao original de aditivo';
  END IF;
  IF EXISTS (SELECT 1 FROM "PropostaAditivoContratual" n WHERE n."matriculaId" = proposta."matriculaId" AND n.versao > proposta.versao)
    OR EXISTS (SELECT 1 FROM "ConferenciaParticipantesAditivo" n WHERE n."propostaId" = proposta.id AND n.versao > participantes.versao) THEN
    RAISE EXCEPTION 'A proposta ou conferência de participantes foi superada';
  END IF;
  PERFORM conferir_fonte_aditivo_117(proposta);
  PERFORM exigir_alcadas_aditivo_117(proposta);
  PERFORM conferir_evidencias_conferencia_aditivo_117(proposta, participantes);
  IF NOT (NEW.snapshot ?& ARRAY['matriculaId','propostaId','propostaHash','conclusaoId','conclusaoHash','originalHash','pdfHash','evidenciasHash','processoId','artefatoId','conferenciaAssinaturaId','ambiente','vigenciaInicio'])
    OR NEW.snapshot->>'matriculaId' IS DISTINCT FROM proposta."matriculaId"
    OR NEW.snapshot->>'propostaId' IS DISTINCT FROM proposta.id
    OR NEW.snapshot->>'propostaHash' IS DISTINCT FROM proposta."entradaHash"
    OR NEW.snapshot->>'conclusaoId' IS DISTINCT FROM conclusao.id
    OR NEW.snapshot->>'conclusaoHash' IS DISTINCT FROM conclusao."entradaHash"
    OR NEW.snapshot->>'originalHash' IS DISTINCT FROM conclusao."originalHash"
    OR NEW.snapshot->>'pdfHash' IS DISTINCT FROM conclusao."pdfHash"
    OR NEW.snapshot->>'evidenciasHash' IS DISTINCT FROM conclusao."evidenciasHash"
    OR NEW.snapshot->>'processoId' IS DISTINCT FROM pe.id
    OR NEW.snapshot->>'artefatoId' IS DISTINCT FROM artefato.id
    OR NEW.snapshot->>'conferenciaAssinaturaId' IS DISTINCT FROM assinatura.id
    OR NEW.snapshot->>'ambiente' IS DISTINCT FROM pe.ambiente
    OR NEW.snapshot->>'vigenciaInicio' IS DISTINCT FROM to_char(proposta."vigenciaInicio", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') THEN
    RAISE EXCEPTION 'Snapshot da conferência final não corresponde à conclusão preservada';
  END IF;
  SELECT * INTO ator FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
  IF NOT FOUND OR NOT ator.ativo OR NOT (ator.papeis && ARRAY['SECRETARIA_ACADEMICA','ADMINISTRADOR']::"Papel"[]) THEN
    RAISE EXCEPTION 'Conferência final exige Secretaria ou Administração ativa';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validar_conferencia_final_aditivo_117 BEFORE INSERT OR UPDATE OR DELETE ON "ConferenciaFinalAditivo"
FOR EACH ROW EXECUTE FUNCTION validar_conferencia_final_aditivo_117();
