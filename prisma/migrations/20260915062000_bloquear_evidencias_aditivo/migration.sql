-- Trava as evidências antes da leitura de disponibilidade, também para INSERT
-- direto. Evita conferir um documento e aguardar uma edição que o arquive.
CREATE FUNCTION bloquear_evidencias_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE p "PropostaAditivoContratual"%ROWTYPE; m "Matricula"%ROWTYPE; documentoId TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO p FROM "PropostaAditivoContratual" WHERE id = NEW."propostaId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de aditivo indisponível'; END IF;
  PERFORM conferir_fonte_aditivo_117(p);
  SELECT * INTO m FROM "Matricula" WHERE id = p."matriculaId";
  FOR documentoId IN
    SELECT DISTINCT referencia FROM (
      SELECT item.value->'representacao'->>'evidenciaDocumentoId' AS referencia
        FROM jsonb_array_elements(NEW.snapshot->'participantes') AS item(value) WHERE item.value ? 'representacao'
      UNION SELECT NEW.snapshot->'maioridade'->>'evidenciaDocumentoId' WHERE NEW.snapshot->'maioridade'->>'classificacao' IS NOT NULL
    ) refs ORDER BY referencia
  LOOP
    PERFORM id FROM "Documento" WHERE id = documentoId FOR SHARE;
    IF documentoId IS NULL OR NOT EXISTS (SELECT 1 FROM "Documento" WHERE id = documentoId AND NOT arquivado AND length(btrim(url)) > 0
      AND ("matriculaId" = m.id OR ("matriculaId" IS NULL AND "leadId" = m."leadId"))) THEN RAISE EXCEPTION 'Evidência indisponível nesta contratação'; END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER a_bloquear_evidencias_aditivo_117 BEFORE INSERT ON "ConferenciaParticipantesAditivo"
  FOR EACH ROW EXECUTE FUNCTION bloquear_evidencias_aditivo_117();
