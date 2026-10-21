-- Corrige colisão entre alias SQL e variável PL/pgSQL. Preserva a migração aplicada.
CREATE OR REPLACE FUNCTION validar_tentativa_envio_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE processo "ProcessoAssinaturaAditivo"%ROWTYPE; conferencia "ConferenciaAssinaturaAditivo"%ROWTYPE;
        proposta "PropostaAditivoContratual"%ROWTYPE; artefato "ArtefatoAditivoContratual"%ROWTYPE;
        participantes "ConferenciaParticipantesAditivo"%ROWTYPE; matricula_id TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Tentativa de envio de aditivo é imutável'; END IF;
  SELECT p."matriculaId" INTO matricula_id FROM "ProcessoAssinaturaAditivo" pe JOIN "PropostaAditivoContratual" p ON p.id = pe."propostaId" WHERE pe.id = NEW."processoId";
  PERFORM id FROM "Matricula" WHERE id = matricula_id FOR UPDATE;
  SELECT * INTO processo FROM "ProcessoAssinaturaAditivo" WHERE id = NEW."processoId" FOR UPDATE;
  IF NOT FOUND OR processo.estado <> 'PREPARADO' OR processo."referenciaExterna" IS NOT NULL OR NEW.numero <> processo."tentativaAtual" + 1 THEN
    RAISE EXCEPTION 'Tentativa exige processo preparado e número atual seguinte';
  END IF;
  SELECT * INTO conferencia FROM "ConferenciaAssinaturaAditivo" WHERE id = processo."conferenciaId" FOR SHARE;
  SELECT * INTO proposta FROM "PropostaAditivoContratual" WHERE id = processo."propostaId" FOR SHARE;
  SELECT * INTO artefato FROM "ArtefatoAditivoContratual" WHERE id = processo."artefatoId" FOR SHARE;
  SELECT * INTO participantes FROM "ConferenciaParticipantesAditivo" WHERE id = artefato."conferenciaId" FOR SHARE;
  IF NOT FOUND OR proposta.id IS NULL OR artefato."propostaId" IS DISTINCT FROM proposta.id OR conferencia."artefatoId" IS DISTINCT FROM artefato.id
    OR participantes."propostaId" IS DISTINCT FROM proposta.id OR NEW."revisaoHash" IS DISTINCT FROM conferencia."revisaoHash"
    OR conferencia.snapshot->>'propostaHash' IS DISTINCT FROM proposta."entradaHash"
    OR conferencia.snapshot->>'conferenciaId' IS DISTINCT FROM participantes.id
    OR conferencia.snapshot->>'conferenciaHash' IS DISTINCT FROM participantes."revisaoHash"
    OR conferencia.snapshot->>'artefatoId' IS DISTINCT FROM artefato.id
    OR conferencia.snapshot->>'pdfHash' IS DISTINCT FROM artefato."pdfHash"
    OR conferencia.snapshot->>'baseHash' IS DISTINCT FROM artefato."baseHash"
    OR conferencia.snapshot->>'versaoProposta' IS DISTINCT FROM proposta.versao::TEXT
    OR conferencia.snapshot->>'conferenciaVersao' IS DISTINCT FROM participantes.versao::TEXT
    OR conferencia.snapshot->>'ambiente' IS DISTINCT FROM proposta.snapshot->'base'->>'ambiente' THEN
    RAISE EXCEPTION 'Tentativa não corresponde à conferência atual';
  END IF;
  IF EXISTS (SELECT 1 FROM "PropostaAditivoContratual" n WHERE n."matriculaId" = proposta."matriculaId" AND n.versao > proposta.versao)
    OR EXISTS (SELECT 1 FROM "ConferenciaParticipantesAditivo" n WHERE n."propostaId" = proposta.id AND n.versao > participantes.versao) THEN
    RAISE EXCEPTION 'A proposta ou conferência de participantes foi superada';
  END IF;
  PERFORM conferir_fonte_aditivo_117(proposta);
  PERFORM conferir_evidencias_conferencia_aditivo_117(proposta, participantes);
  PERFORM exigir_alcadas_aditivo_117(proposta);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION validar_observacao_envio_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE tentativa "TentativaEnvioAditivo"%ROWTYPE; processo "ProcessoAssinaturaAditivo"%ROWTYPE; matricula_id TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Observação de envio de aditivo é imutável'; END IF;
  SELECT * INTO tentativa FROM "TentativaEnvioAditivo" WHERE id = NEW."tentativaId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tentativa de envio inexistente'; END IF;
  SELECT p."matriculaId" INTO matricula_id FROM "ProcessoAssinaturaAditivo" pe JOIN "PropostaAditivoContratual" p ON p.id = pe."propostaId" WHERE pe.id = tentativa."processoId";
  PERFORM id FROM "Matricula" WHERE id = matricula_id FOR UPDATE;
  SELECT * INTO processo FROM "ProcessoAssinaturaAditivo" WHERE id = tentativa."processoId" FOR UPDATE;
  IF processo.estado NOT IN ('ENVIANDO', 'ENVIO_INCERTO', 'ENVIADO') OR processo."tentativaAtual" <> tentativa.numero THEN RAISE EXCEPTION 'Observação não corresponde à tentativa atual em envio'; END IF;
  IF processo.estado = 'ENVIADO' AND (NEW.resultado <> 'REGISTRADO' OR NEW."referenciaExterna" IS DISTINCT FROM processo."referenciaExterna") THEN RAISE EXCEPTION 'Processo enviado só aceita confirmação da mesma referência'; END IF;
  IF (NEW.resultado = 'REGISTRADO') IS DISTINCT FROM (NEW."referenciaExterna" IS NOT NULL) THEN RAISE EXCEPTION 'Resultado não corresponde à referência externa'; END IF;
  RETURN NEW;
END;
$$;
