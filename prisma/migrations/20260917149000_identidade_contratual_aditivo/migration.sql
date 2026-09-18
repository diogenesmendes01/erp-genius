-- 224: identidade conferida por contrato; preserva cadastro compartilhado e portal.
CREATE FUNCTION identidade_cadastral_aditivo_224(p "PropostaAditivoContratual", prefixo TEXT, base JSONB)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE anterior JSONB; item JSONB; origem TEXT; propriedade TEXT; valor JSONB; novo TEXT; resultado JSONB := base;
BEGIN
  IF prefixo NOT IN ('ALUNO','PAGADOR') THEN RAISE EXCEPTION 'Origem cadastral inválida'; END IF;
  SELECT v.condicoes INTO anterior FROM "VersaoCondicoesAditivo" v
    JOIN "AplicacaoCondicoesAditivo" a ON a."versaoCondicoesId"=v.id
    JOIN "PropostaAditivoContratual" proposta ON proposta.id=v."propostaId"
    WHERE v."matriculaId"=p."matriculaId" AND proposta.versao<p.versao ORDER BY v.versao DESC LIMIT 1;
  FOREACH propriedade IN ARRAY ARRAY['nome','email','documento'] LOOP
    origem := prefixo || '_' || upper(propriedade);
    valor := anterior->origem;
    IF valor IS NOT NULL THEN
      novo := CASE WHEN propriedade='email' AND valor->>'tipo'='EMAIL' THEN valor->>'email'
        WHEN propriedade<>'email' AND valor->>'tipo'='TEXT' THEN valor->>'texto' ELSE NULL END;
      IF NULLIF(btrim(novo),'') IS NULL THEN RAISE EXCEPTION 'Identidade contratual anterior inválida'; END IF;
      resultado := jsonb_set(resultado, ARRAY[propriedade], to_jsonb(btrim(novo)));
    END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(p.snapshot->'entrada'->'alteracoes') WHERE value->>'origem'=origem LOOP
      valor := item->'valorEstruturado';
      IF valor IS NOT NULL THEN
        novo := CASE WHEN propriedade='email' AND valor->>'tipo'='EMAIL' THEN valor->>'email'
          WHEN propriedade<>'email' AND valor->>'tipo'='TEXT' THEN valor->>'texto' ELSE NULL END;
        IF NULLIF(btrim(novo),'') IS NULL OR btrim(novo) IS DISTINCT FROM item->>'novo' THEN RAISE EXCEPTION 'Identidade estruturada diverge da alteração aprovada'; END IF;
        resultado := jsonb_set(resultado, ARRAY[propriedade], to_jsonb(btrim(novo)));
      ELSIF item->>'novo' IS DISTINCT FROM resultado->>propriedade THEN
        RAISE EXCEPTION 'Estruture a alteração cadastral antes dos signatários';
      END IF;
    END LOOP;
  END LOOP;
  RETURN resultado;
END;
$$;
CREATE OR REPLACE FUNCTION conferir_participantes_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
      esperado := identidade_cadastral_aditivo_224(p, 'ALUNO', esperado);
    ELSIF papel = 'RESPONSAVEL_FINANCEIRO' AND pagador.tipo <> 'EMPRESA' THEN
      esperado := jsonb_build_object('nome', btrim(pagador.dados->>'nome'), 'email', btrim(pagador.dados->>'email'), 'documento', btrim(pagador.dados->>'documento'));
      esperado := identidade_cadastral_aditivo_224(p, 'PAGADOR', esperado);
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
