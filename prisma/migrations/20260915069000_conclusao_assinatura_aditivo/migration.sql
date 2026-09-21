-- Q117: recebimento imutável do documento de aditivo já assinado. Não aprova,
-- aplica ou revalida cadastro e propostas posteriores ao envio.
CREATE TABLE "ConclusaoAssinaturaAditivo" (
  id TEXT PRIMARY KEY,
  "processoId" TEXT NOT NULL UNIQUE REFERENCES "ProcessoAssinaturaAditivo"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "referenciaExterna" TEXT NOT NULL CHECK (length(btrim("referenciaExterna")) BETWEEN 1 AND 200 AND "referenciaExterna" = btrim("referenciaExterna")),
  "originalHash" TEXT NOT NULL CHECK ("originalHash" ~ '^[a-f0-9]{64}$'),
  "pdfAssinado" BYTEA NOT NULL CHECK (octet_length("pdfAssinado") BETWEEN 6 AND 20971520),
  "pdfHash" TEXT NOT NULL CHECK ("pdfHash" ~ '^[a-f0-9]{64}$'),
  evidencias BYTEA NOT NULL CHECK (octet_length(evidencias) BETWEEN 1 AND 20971520),
  "evidenciasHash" TEXT NOT NULL CHECK ("evidenciasHash" ~ '^[a-f0-9]{64}$'),
  assinaturas JSONB NOT NULL CHECK (jsonb_typeof(assinaturas) = 'array'),
  "concluidaEm" TIMESTAMP(3) NOT NULL,
  "entradaHash" TEXT NOT NULL CHECK ("entradaHash" ~ '^[a-f0-9]{64}$'),
  "registradaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
);

CREATE FUNCTION preservar_conclusao_assinatura_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE processo "ProcessoAssinaturaAditivo"%ROWTYPE; proposta "PropostaAditivoContratual"%ROWTYPE;
        artefato "ArtefatoAditivoContratual"%ROWTYPE; conferencia "ConferenciaAssinaturaAditivo"%ROWTYPE;
        participantes "ConferenciaParticipantesAditivo"%ROWTYPE; enviada TIMESTAMP; pessoas JSONB; matricula_id TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Conclusão de assinatura de aditivo é imutável'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT p."matriculaId" INTO matricula_id FROM "ProcessoAssinaturaAditivo" pe JOIN "PropostaAditivoContratual" p ON p.id = pe."propostaId" WHERE pe.id = NEW."processoId";
  PERFORM id FROM "Matricula" WHERE id = matricula_id FOR UPDATE;
  SELECT * INTO processo FROM "ProcessoAssinaturaAditivo" WHERE id = NEW."processoId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Processo de assinatura de aditivo inexistente'; END IF;
  SELECT * INTO proposta FROM "PropostaAditivoContratual" WHERE id = processo."propostaId" FOR SHARE;
  SELECT * INTO artefato FROM "ArtefatoAditivoContratual" WHERE id = processo."artefatoId" FOR SHARE;
  SELECT * INTO conferencia FROM "ConferenciaAssinaturaAditivo" WHERE id = processo."conferenciaId" FOR SHARE;
  SELECT * INTO participantes FROM "ConferenciaParticipantesAditivo" WHERE id = artefato."conferenciaId" FOR SHARE;
  IF proposta.id IS NULL OR artefato."propostaId" IS DISTINCT FROM proposta.id OR conferencia."artefatoId" IS DISTINCT FROM artefato.id
    OR participantes."propostaId" IS DISTINCT FROM proposta.id OR processo.estado <> 'ENVIADO'
    OR processo."referenciaExterna" IS DISTINCT FROM NEW."referenciaExterna" OR artefato."pdfHash" IS DISTINCT FROM NEW."originalHash"
    OR NOT EXISTS (SELECT 1 FROM "ObservacaoEnvioAditivo" o JOIN "TentativaEnvioAditivo" t ON t.id = o."tentativaId"
      WHERE t."processoId" = processo.id AND t.numero = processo."tentativaAtual" AND o.resultado = 'REGISTRADO' AND o."referenciaExterna" = processo."referenciaExterna") THEN
    RAISE EXCEPTION 'Conclusão incompatível com processo, envio confirmado e original';
  END IF;
  SELECT "iniciadaEm" INTO enviada FROM "TentativaEnvioAditivo" WHERE "processoId" = processo.id AND numero = processo."tentativaAtual";
  IF enviada IS NULL OR NEW."concluidaEm" < enviada OR NEW."concluidaEm" > (clock_timestamp() AT TIME ZONE 'UTC') THEN RAISE EXCEPTION 'Data de conclusão incompatível'; END IF;
  IF substring(NEW."pdfAssinado" FROM 1 FOR 5) <> convert_to('%PDF-', 'UTF8') THEN RAISE EXCEPTION 'Arquivos de conclusão inválidos'; END IF;
  IF encode(sha256(artefato.pdf), 'hex') IS DISTINCT FROM artefato."pdfHash" THEN RAISE EXCEPTION 'Integridade do original de aditivo divergente'; END IF;
  IF encode(sha256(NEW."pdfAssinado"), 'hex') IS DISTINCT FROM NEW."pdfHash" OR encode(sha256(NEW.evidencias), 'hex') IS DISTINCT FROM NEW."evidenciasHash" THEN RAISE EXCEPTION 'Hashes divergentes dos arquivos'; END IF;
  pessoas := participantes.snapshot->'participantes';
  IF jsonb_typeof(pessoas) IS DISTINCT FROM 'array' OR jsonb_array_length(pessoas) = 0
    OR jsonb_array_length(NEW.assinaturas) <> jsonb_array_length(pessoas) THEN RAISE EXCEPTION 'Assinaturas obrigatórias ausentes'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(pessoas) pessoa WHERE jsonb_typeof(pessoa) IS DISTINCT FROM 'object'
    OR jsonb_typeof(pessoa->'papel') IS DISTINCT FROM 'string' OR jsonb_typeof(pessoa->'etapa') IS DISTINCT FROM 'string'
    OR jsonb_typeof(pessoa->'identidade') IS DISTINCT FROM 'object'
    OR jsonb_typeof(pessoa->'identidade'->'nome') IS DISTINCT FROM 'string'
    OR jsonb_typeof(pessoa->'identidade'->'email') IS DISTINCT FROM 'string'
    OR jsonb_typeof(pessoa->'identidade'->'documento') IS DISTINCT FROM 'string') THEN
    RAISE EXCEPTION 'Participantes preservados inválidos para conclusão';
  END IF;
  IF (SELECT count(DISTINCT x->>'papel') FROM jsonb_array_elements(NEW.assinaturas) x) <> jsonb_array_length(pessoas)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.assinaturas) x WHERE jsonb_typeof(x) IS DISTINCT FROM 'object'
      OR jsonb_typeof(x->'papel') IS DISTINCT FROM 'string' OR jsonb_typeof(x->'etapa') IS DISTINCT FROM 'string'
      OR jsonb_typeof(x->'identidadeHash') IS DISTINCT FROM 'string' OR (x->>'identidadeHash') !~ '^[a-f0-9]{64}$'
      OR jsonb_typeof(x->'referenciaAssinatura') IS DISTINCT FROM 'string' OR btrim(x->>'referenciaAssinatura') = ''
      OR jsonb_typeof(x->'assinadaEm') IS DISTINCT FROM 'string')
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(pessoas) pessoa WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.assinaturas) x
      WHERE x->>'papel' = pessoa->>'papel' AND x->>'etapa' = pessoa->>'etapa'
        AND x->>'identidadeHash' = encode(sha256(convert_to(format('{"nome":%s,"email":%s,"documento":%s}',
          to_json(pessoa->'identidade'->>'nome')::text, to_json(pessoa->'identidade'->>'email')::text,
          to_json(pessoa->'identidade'->>'documento')::text), 'UTF8')), 'hex'))) THEN
    RAISE EXCEPTION 'Papéis ou identidades de assinatura incompatíveis';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.assinaturas) x WHERE (x->>'assinadaEm')::timestamptz < (enviada AT TIME ZONE 'UTC') OR (x->>'assinadaEm')::timestamptz > (NEW."concluidaEm" AT TIME ZONE 'UTC')) THEN
    RAISE EXCEPTION 'Data de assinatura incompatível';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.assinaturas) e CROSS JOIN jsonb_array_elements(NEW.assinaturas) c
    WHERE e->>'etapa' = 'ESCOLA' AND c->>'etapa' = 'CLIENTE' AND (e->>'assinadaEm')::timestamptz < (c->>'assinadaEm')::timestamptz) THEN
    RAISE EXCEPTION 'Escola deve assinar após clientes';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_conclusao_assinatura_aditivo_117 BEFORE INSERT OR UPDATE OR DELETE ON "ConclusaoAssinaturaAditivo"
FOR EACH ROW EXECUTE FUNCTION preservar_conclusao_assinatura_aditivo_117();
