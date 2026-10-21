-- Q117: nova conferência para o aditivo, sem herdar assinaturas do original.
CREATE TABLE "ConferenciaParticipantesAditivo" (
  id TEXT PRIMARY KEY,
  "propostaId" TEXT NOT NULL REFERENCES "PropostaAditivoContratual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "decisaoId" TEXT NOT NULL REFERENCES "DecisaoAditivoContratual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "autorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  versao INTEGER NOT NULL CHECK (versao > 0),
  "propostaHash" TEXT NOT NULL CHECK ("propostaHash" ~ '^[a-f0-9]{64}$'),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  "revisaoHash" TEXT NOT NULL CHECK ("revisaoHash" ~ '^[a-f0-9]{64}$'),
  "entradaHash" TEXT NOT NULL CHECK ("entradaHash" ~ '^[a-f0-9]{64}$'),
  "chaveIdempotencia" TEXT NOT NULL CHECK (length(btrim("chaveIdempotencia")) BETWEEN 8 AND 100),
  motivo TEXT NOT NULL CHECK (length(btrim(motivo)) BETWEEN 5 AND 2000 AND motivo = btrim(motivo)),
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
);
CREATE UNIQUE INDEX "ConferenciaParticipantesAditivo_propostaId_versao_key" ON "ConferenciaParticipantesAditivo"("propostaId", versao);
CREATE UNIQUE INDEX "ConferenciaParticipantesAditivo_autorId_chaveIdempotencia_key" ON "ConferenciaParticipantesAditivo"("autorId", "chaveIdempotencia");

CREATE FUNCTION conferir_participantes_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE p "PropostaAditivoContratual"%ROWTYPE; decisao "DecisaoAditivoContratual"%ROWTYPE; ator "Usuario"%ROWTYPE;
  m "Matricula"%ROWTYPE; aluno "Aluno"%ROWTYPE; pagador "PagadorPreparacaoMatricula"%ROWTYPE;
  modelo "VersaoModeloContratual"%ROWTYPE; ultima INTEGER; participante JSONB; regra JSONB;
  papeis TEXT[] := ARRAY[]::TEXT[]; exigidos TEXT[] := ARRAY[]::TEXT[]; papel TEXT; condicao TEXT; maioridade TEXT;
  aplica BOOLEAN; documentoId TEXT; esperado JSONB;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Conferência de participantes do aditivo é imutável'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO p FROM "PropostaAditivoContratual" WHERE id = NEW."propostaId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de aditivo indisponível'; END IF;
  PERFORM conferir_fonte_aditivo_117(p);
  SELECT * INTO decisao FROM "DecisaoAditivoContratual" WHERE id = NEW."decisaoId";
  IF NOT FOUND OR NOT decisao.aprovada OR decisao."propostaId" <> p.id OR decisao."propostaHash" <> p."entradaHash"
    OR NEW."propostaHash" <> p."entradaHash" THEN RAISE EXCEPTION 'Aditivo exige decisão administrativa aprovada e exata'; END IF;
  IF EXISTS (SELECT 1 FROM "PropostaAditivoContratual" WHERE "matriculaId" = p."matriculaId" AND versao > p.versao) THEN RAISE EXCEPTION 'Existe proposta de aditivo mais recente'; END IF;
  SELECT * INTO ator FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
  IF NOT FOUND OR NOT ator.ativo OR NOT (ator.papeis && ARRAY['SECRETARIA_ACADEMICA','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Conferência exige Secretaria ou Administração ativa'; END IF;
  SELECT COALESCE(MAX(versao), 0) INTO ultima FROM "ConferenciaParticipantesAditivo" WHERE "propostaId" = p.id;
  IF NEW.versao <> ultima + 1 THEN RAISE EXCEPTION 'A conferência recebeu outra versão'; END IF;
  IF (NEW.snapshot @> jsonb_build_object('propostaId', p.id, 'propostaHash', p."entradaHash", 'decisaoId', decisao.id,
    'identificacoesConferidas', true, 'assinaturasHerdadas', '[]'::jsonb)) IS DISTINCT FROM TRUE
    OR jsonb_typeof(NEW.snapshot->'participantes') IS DISTINCT FROM 'array'
    OR jsonb_array_length(NEW.snapshot->'participantes') NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Snapshot de participantes inválido'; END IF;
  SELECT * INTO m FROM "Matricula" WHERE id = p."matriculaId";
  SELECT * INTO aluno FROM "Aluno" WHERE id = m."alunoId" FOR SHARE;
  SELECT * INTO pagador FROM "PagadorPreparacaoMatricula" WHERE id = p.snapshot->'base'->'pagador'->>'id';
  SELECT * INTO modelo FROM "VersaoModeloContratual" WHERE id = p."modeloId";
  maioridade := NEW.snapshot->'maioridade'->>'classificacao';
  IF NEW.snapshot->'plano'->'contexto'->>'pagador' IS DISTINCT FROM pagador.tipo
    OR NEW.snapshot->'plano'->'contexto'->>'maioridade' IS DISTINCT FROM maioridade THEN RAISE EXCEPTION 'Contexto dos signatários divergente'; END IF;
  IF maioridade IS NOT NULL AND maioridade NOT IN ('MAIOR','MENOR') THEN RAISE EXCEPTION 'Classificação de maioridade inválida'; END IF;
  FOR regra IN SELECT value FROM jsonb_array_elements(modelo.conteudo->'assinaturas') LOOP
    papel := regra->>'papel'; condicao := regra->>'condicao';
    aplica := CASE condicao WHEN 'SEMPRE' THEN TRUE WHEN 'PAGADOR_DISTINTO' THEN pagador.tipo <> 'ALUNO'
      WHEN 'PAGADOR_EMPRESA' THEN pagador.tipo = 'EMPRESA' WHEN 'ALUNO_MAIOR' THEN maioridade = 'MAIOR'
      WHEN 'ALUNO_MENOR' THEN maioridade = 'MENOR' ELSE NULL END;
    IF aplica IS NULL THEN RAISE EXCEPTION 'Conferir a maioridade e as regras de assinatura'; END IF;
    IF aplica AND NOT (papel = ANY(exigidos)) THEN exigidos := array_append(exigidos, papel); END IF;
  END LOOP;
  FOR participante IN SELECT value FROM jsonb_array_elements(NEW.snapshot->'participantes') LOOP
    papel := participante->>'papel';
    IF papel IS NULL OR papel = ANY(papeis) OR NOT (papel = ANY(exigidos)) THEN RAISE EXCEPTION 'Papéis de assinatura divergentes'; END IF;
    papeis := array_append(papeis, papel);
    IF jsonb_typeof(participante->'identidade') IS DISTINCT FROM 'object'
      OR NULLIF(btrim(participante->'identidade'->>'nome'), '') IS NULL
      OR NULLIF(btrim(participante->'identidade'->>'documento'), '') IS NULL
      OR NULLIF(btrim(participante->'identidade'->>'email'), '') IS NULL THEN RAISE EXCEPTION 'Identificação do signatário incompleta'; END IF;
    IF participante->>'etapa' IS DISTINCT FROM (CASE WHEN papel = 'REPRESENTANTE_ESCOLA' THEN 'ESCOLA' ELSE 'CLIENTE' END) THEN RAISE EXCEPTION 'Etapa de assinatura divergente'; END IF;
    IF papel = 'ALUNO' THEN
      esperado := jsonb_build_object('nome', btrim(concat_ws(' ', aluno."primeiroNome", aluno.sobrenome)), 'email', btrim(aluno.email), 'documento', btrim(aluno.documento));
    ELSIF papel = 'RESPONSAVEL_FINANCEIRO' AND pagador.tipo <> 'EMPRESA' THEN
      esperado := jsonb_build_object('nome', btrim(pagador.dados->>'nome'), 'email', btrim(pagador.dados->>'email'), 'documento', btrim(pagador.dados->>'documento'));
    ELSE esperado := NULL;
    END IF;
    IF esperado IS NOT NULL THEN
      IF participante->'identidade' IS DISTINCT FROM esperado OR participante ? 'representacao' THEN RAISE EXCEPTION 'Identidade não corresponde ao aluno ou pagador'; END IF;
    ELSIF jsonb_typeof(participante->'representacao') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Representação exige evidência'; END IF;
  END LOOP;
  IF cardinality(papeis) <> cardinality(exigidos) OR NOT EXISTS (SELECT 1 FROM unnest(papeis) v WHERE v <> 'REPRESENTANTE_ESCOLA') THEN RAISE EXCEPTION 'Identifique todos os signatários exigidos'; END IF;
  FOR documentoId IN SELECT item.value->'representacao'->>'evidenciaDocumentoId' FROM jsonb_array_elements(NEW.snapshot->'participantes') AS item(value) WHERE item.value ? 'representacao'
    UNION SELECT NEW.snapshot->'maioridade'->>'evidenciaDocumentoId' WHERE maioridade IS NOT NULL LOOP
    IF documentoId IS NULL OR NOT EXISTS (SELECT 1 FROM "Documento" WHERE id = documentoId AND NOT arquivado AND length(btrim(url)) > 0
      AND ("matriculaId" = m.id OR ("matriculaId" IS NULL AND "leadId" = m."leadId"))) THEN RAISE EXCEPTION 'Evidência indisponível nesta contratação'; END IF;
    PERFORM id FROM "Documento" WHERE id = documentoId FOR SHARE;
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER conferir_participantes_aditivo_117 BEFORE INSERT OR UPDATE OR DELETE ON "ConferenciaParticipantesAditivo"
  FOR EACH ROW EXECUTE FUNCTION conferir_participantes_aditivo_117();
