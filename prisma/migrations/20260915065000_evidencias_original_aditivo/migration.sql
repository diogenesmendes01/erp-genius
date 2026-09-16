-- Q117: a preservação do original e sua conferência interna só aceitam as
-- evidências que ainda são exatamente as evidências da conferência preservada.
CREATE FUNCTION conferir_evidencias_conferencia_aditivo_117(
  p_proposta "PropostaAditivoContratual",
  p_conferencia "ConferenciaParticipantesAditivo"
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE item JSONB; representacao JSONB; referencia TEXT; documento_snapshot JSONB;
        ids_snapshot TEXT[] := ARRAY[]::TEXT[]; referencias TEXT[] := ARRAY[]::TEXT[];
        ids TEXT[]; documento RECORD; quantidade_documentos INTEGER := 0; lead_id TEXT;
BEGIN
  IF jsonb_typeof(p_conferencia.snapshot->'documentos') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_conferencia.snapshot->'participantes') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Snapshot de evidências da conferência é inválido';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_conferencia.snapshot->'documentos') LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object'
      OR jsonb_typeof(item->'id') IS DISTINCT FROM 'string'
      OR btrim(item->>'id') = ''
      OR jsonb_typeof(item->'nome') IS DISTINCT FROM 'string'
      OR jsonb_typeof(item->'url') IS DISTINCT FROM 'string'
      OR jsonb_typeof(item->'categoria') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Snapshot de evidências da conferência é inválido';
    END IF;
    referencia := item->>'id';
    IF referencia = ANY(ids_snapshot) THEN
      RAISE EXCEPTION 'Snapshot de evidências contém documento duplicado';
    END IF;
    ids_snapshot := array_append(ids_snapshot, referencia);
  END LOOP;

  IF p_conferencia.snapshot->'maioridade' IS NOT NULL AND p_conferencia.snapshot->'maioridade' <> 'null'::jsonb THEN
    referencia := p_conferencia.snapshot->'maioridade'->>'evidenciaDocumentoId';
    IF jsonb_typeof(p_conferencia.snapshot->'maioridade'->'evidenciaDocumentoId') IS DISTINCT FROM 'string' OR btrim(referencia) = '' THEN
      RAISE EXCEPTION 'Referência de evidência da maioridade é inválida';
    END IF;
    referencias := array_append(referencias, referencia);
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_conferencia.snapshot->'participantes') LOOP
    representacao := item->'representacao';
    IF representacao IS NOT NULL AND representacao <> 'null'::jsonb THEN
      referencia := representacao->>'evidenciaDocumentoId';
      IF jsonb_typeof(representacao->'evidenciaDocumentoId') IS DISTINCT FROM 'string' OR btrim(referencia) = '' THEN
        RAISE EXCEPTION 'Referência de evidência de representação é inválida';
      END IF;
      referencias := array_append(referencias, referencia);
    END IF;
  END LOOP;
  SELECT ARRAY(SELECT DISTINCT id FROM unnest(referencias) AS id ORDER BY id) INTO ids;
  IF cardinality(ids_snapshot) <> cardinality(ids)
    OR EXISTS (SELECT 1 FROM unnest(ids) AS id WHERE NOT (id = ANY(ids_snapshot))) THEN
    RAISE EXCEPTION 'Snapshot de evidências não corresponde às referências da conferência';
  END IF;

  SELECT "leadId" INTO lead_id FROM "Matricula" WHERE id = p_proposta."matriculaId";
  -- O bloqueio vem antes da leitura dos valores que serão comparados.
  IF cardinality(ids) > 0 THEN
    PERFORM id FROM "Documento" WHERE id = ANY(ids) ORDER BY id FOR SHARE;
  END IF;
  FOR documento IN
    SELECT id, nome, url, categoria FROM "Documento"
    WHERE id = ANY(ids) AND NOT arquivado AND btrim(url) <> ''
      AND ("matriculaId" = p_proposta."matriculaId"
        OR ("matriculaId" IS NULL AND lead_id IS NOT NULL AND "leadId" = lead_id))
    ORDER BY id
  LOOP
    quantidade_documentos := quantidade_documentos + 1;
    SELECT value INTO documento_snapshot FROM jsonb_array_elements(p_conferencia.snapshot->'documentos')
      WHERE value->>'id' = documento.id;
    IF documento_snapshot IS NULL
      OR documento_snapshot->>'nome' IS DISTINCT FROM documento.nome
      OR documento_snapshot->>'url' IS DISTINCT FROM documento.url
      OR documento_snapshot->>'categoria' IS DISTINCT FROM documento.categoria::TEXT THEN
      RAISE EXCEPTION 'A evidência atual diverge da conferência preservada';
    END IF;
  END LOOP;
  IF quantidade_documentos <> cardinality(ids) THEN
    RAISE EXCEPTION 'Uma evidência da conferência não está mais disponível';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION validar_artefato_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
  PERFORM conferir_evidencias_conferencia_aditivo_117(proposta, conferencia);
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

CREATE OR REPLACE FUNCTION validar_conferencia_assinatura_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
  PERFORM conferir_evidencias_conferencia_aditivo_117(proposta, participantes);
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
