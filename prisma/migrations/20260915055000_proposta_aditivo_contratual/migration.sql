-- Q117: proposta e decisão internas são fatos imutáveis. Não formalizam nem aplicam condições.
CREATE TABLE "PropostaAditivoContratual" (
  id TEXT PRIMARY KEY,
  "matriculaId" TEXT NOT NULL REFERENCES "Matricula"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "conclusaoOriginalId" TEXT NOT NULL REFERENCES "ConclusaoAssinaturaContratual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "modeloId" TEXT NOT NULL REFERENCES "VersaoModeloContratual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  versao INTEGER NOT NULL CHECK (versao > 0),
  "preparadaPorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "vigenciaInicio" TIMESTAMP(3) NOT NULL,
  motivo TEXT NOT NULL CHECK (length(btrim(motivo)) BETWEEN 5 AND 4000 AND motivo = btrim(motivo)),
  "baseHash" TEXT NOT NULL CHECK ("baseHash" ~ '^[a-f0-9]{64}$'),
  "alteracoesHash" TEXT NOT NULL CHECK ("alteracoesHash" ~ '^[a-f0-9]{64}$'),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  "entradaHash" TEXT NOT NULL CHECK ("entradaHash" ~ '^[a-f0-9]{64}$'),
  "chaveIdempotencia" TEXT NOT NULL CHECK (length(btrim("chaveIdempotencia")) BETWEEN 8 AND 200 AND "chaveIdempotencia" = btrim("chaveIdempotencia")),
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
);
CREATE UNIQUE INDEX "PropostaAditivoContratual_matriculaId_versao_key" ON "PropostaAditivoContratual"("matriculaId", versao);
CREATE UNIQUE INDEX "PropostaAditivoContratual_preparadaPorId_chaveIdempotencia_key" ON "PropostaAditivoContratual"("preparadaPorId", "chaveIdempotencia");
CREATE INDEX "PropostaAditivoContratual_matriculaId_criadaEm_idx" ON "PropostaAditivoContratual"("matriculaId", "criadaEm");

CREATE TABLE "DecisaoAditivoContratual" (
  id TEXT PRIMARY KEY,
  "propostaId" TEXT NOT NULL REFERENCES "PropostaAditivoContratual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "decisorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  aprovada BOOLEAN NOT NULL,
  motivo TEXT NOT NULL CHECK (length(btrim(motivo)) BETWEEN 5 AND 4000 AND motivo = btrim(motivo)),
  "propostaHash" TEXT NOT NULL CHECK ("propostaHash" ~ '^[a-f0-9]{64}$'),
  "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
);
CREATE UNIQUE INDEX "DecisaoAditivoContratual_propostaId_key" ON "DecisaoAditivoContratual"("propostaId");

CREATE FUNCTION conferir_fonte_aditivo_117(p "PropostaAditivoContratual")
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE c "ConclusaoAssinaturaContratual"%ROWTYPE; processo "ProcessoAssinaturaContratual"%ROWTYPE;
        artefato "ArtefatoContratual"%ROWTYPE; modelo "VersaoModeloContratual"%ROWTYPE; publicacao "DecisaoModeloContratual"%ROWTYPE;
BEGIN
  -- Ordem global: calendário, matrícula, processo fonte, usuário.
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  PERFORM id FROM "Matricula" WHERE id = p."matriculaId" FOR UPDATE;
  SELECT * INTO c FROM "ConclusaoAssinaturaContratual" WHERE id = p."conclusaoOriginalId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conclusão original indisponível'; END IF;
  SELECT * INTO processo FROM "ProcessoAssinaturaContratual" WHERE id = c."processoId" FOR UPDATE;
  SELECT * INTO artefato FROM "ArtefatoContratual" WHERE id = processo."artefatoId" FOR SHARE;
  SELECT * INTO modelo FROM "VersaoModeloContratual" WHERE id = p."modeloId" FOR SHARE;
  SELECT * INTO publicacao FROM "DecisaoModeloContratual" WHERE "modeloId" = p."modeloId" AND aprovada FOR SHARE;
  IF NOT FOUND OR modelo.conteudo->>'finalidade' <> 'ADITIVO' THEN RAISE EXCEPTION 'Aditivo exige modelo ADITIVO aprovado'; END IF;
  IF processo."matriculaId" IS DISTINCT FROM p."matriculaId" OR processo.estado::text <> 'ENVIADO'
    OR processo."referenciaExterna" IS NULL OR c."referenciaExterna" IS DISTINCT FROM processo."referenciaExterna"
    OR c."originalHash" IS DISTINCT FROM artefato."pdfHash" THEN
    RAISE EXCEPTION 'Aditivo exige conclusão do processo enviado, matrícula e original exatos';
  END IF;
  IF p.snapshot->'base'->>'conclusaoHash' IS DISTINCT FROM c."entradaHash"
    OR p.snapshot->'base'->>'originalHash' IS DISTINCT FROM c."originalHash"
    OR p.snapshot->'base'->>'originalHash' IS DISTINCT FROM artefato."pdfHash"
    OR p.snapshot->'base'->>'referenciaExterna' IS DISTINCT FROM processo."referenciaExterna"
    OR p.snapshot->'base'->>'ambiente' IS DISTINCT FROM processo.ambiente::text
    OR p.snapshot->'base'->>'artefatoOriginalId' IS DISTINCT FROM artefato.id
    OR p.snapshot->'base'->>'modeloHash' IS DISTINCT FROM modelo."conteudoHash"
    OR p.snapshot->'base'->>'publicacaoId' IS DISTINCT FROM publicacao.id THEN
    RAISE EXCEPTION 'Base preservada não corresponde à conclusão, original, modelo ou publicação';
  END IF;
  IF EXISTS (SELECT 1 FROM "ConclusaoAssinaturaContratual" outra JOIN "ProcessoAssinaturaContratual" op ON op.id = outra."processoId"
    WHERE op."matriculaId" = p."matriculaId" AND outra.id <> c.id) THEN
    RAISE EXCEPTION 'Há mais de um original assinado nesta matrícula';
  END IF;
  IF p.snapshot->'base'->'condicoes'->>'id' IS DISTINCT FROM (SELECT id FROM "CondicoesEntradaPreparacao" WHERE "matriculaId" = p."matriculaId" ORDER BY versao DESC LIMIT 1)
    OR p.snapshot->'base'->'pagador'->>'id' IS DISTINCT FROM (SELECT id FROM "PagadorPreparacaoMatricula" WHERE "matriculaId" = p."matriculaId" ORDER BY versao DESC LIMIT 1) THEN
    RAISE EXCEPTION 'Condições ou pagador da base do aditivo mudaram';
  END IF;
END;
$$;

CREATE FUNCTION validar_proposta_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE ator "Usuario"%ROWTYPE; ultima INTEGER;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Proposta de aditivo contratual é imutável'; END IF;
  IF NOT (NEW.snapshot ?& ARRAY['matriculaId','conclusaoOriginalId','modeloId','versao','preparadaPorId','vigenciaInicio','motivo','baseHash','alteracoesHash','base','alteracoes','documento','entrada'])
    OR jsonb_typeof(NEW.snapshot->'base') <> 'object' OR jsonb_typeof(NEW.snapshot->'alteracoes') <> 'array'
    OR jsonb_array_length(NEW.snapshot->'alteracoes') = 0 OR jsonb_typeof(NEW.snapshot->'documento') <> 'object'
    OR jsonb_typeof(NEW.snapshot->'entrada') <> 'object'
    OR NEW.snapshot->>'matriculaId' IS DISTINCT FROM NEW."matriculaId"
    OR NEW.snapshot->>'conclusaoOriginalId' IS DISTINCT FROM NEW."conclusaoOriginalId"
    OR NEW.snapshot->>'modeloId' IS DISTINCT FROM NEW."modeloId"
    OR NEW.snapshot->>'versao' IS DISTINCT FROM NEW.versao::text
    OR NEW.snapshot->>'preparadaPorId' IS DISTINCT FROM NEW."preparadaPorId"
    OR NEW.snapshot->>'motivo' IS DISTINCT FROM NEW.motivo
    OR NEW.snapshot->>'baseHash' IS DISTINCT FROM NEW."baseHash"
    OR NEW.snapshot->>'alteracoesHash' IS DISTINCT FROM NEW."alteracoesHash"
    OR NEW.snapshot->>'vigenciaInicio' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?Z$'
    OR (NEW.snapshot->>'vigenciaInicio')::timestamptz <> NEW."vigenciaInicio" AT TIME ZONE 'UTC' THEN
    RAISE EXCEPTION 'Snapshot do aditivo não corresponde à proposta';
  END IF;
  PERFORM conferir_fonte_aditivo_117(NEW);
  SELECT * INTO ator FROM "Usuario" WHERE id = NEW."preparadaPorId" FOR SHARE;
  IF NOT FOUND OR NOT ator.ativo OR NOT (ator.papeis && ARRAY['SECRETARIA_ACADEMICA','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Preparação exige Secretaria ou Administração ativa'; END IF;
  SELECT COALESCE(MAX(versao), 0) INTO ultima FROM "PropostaAditivoContratual" WHERE "matriculaId" = NEW."matriculaId";
  IF NEW.versao <> ultima + 1 THEN RAISE EXCEPTION 'Versão da proposta de aditivo mudou'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validar_proposta_aditivo_117 BEFORE INSERT OR UPDATE OR DELETE ON "PropostaAditivoContratual" FOR EACH ROW EXECUTE FUNCTION validar_proposta_aditivo_117();

CREATE FUNCTION validar_decisao_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaAditivoContratual"%ROWTYPE; ator "Usuario"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisão de aditivo contratual é imutável'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO proposta FROM "PropostaAditivoContratual" WHERE id = NEW."propostaId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de aditivo inexistente'; END IF;
  PERFORM id FROM "Matricula" WHERE id = proposta."matriculaId" FOR UPDATE;
  PERFORM "processoId" FROM "ConclusaoAssinaturaContratual" WHERE id = proposta."conclusaoOriginalId" FOR SHARE;
  PERFORM id FROM "ProcessoAssinaturaContratual" WHERE id = (SELECT "processoId" FROM "ConclusaoAssinaturaContratual" WHERE id = proposta."conclusaoOriginalId") FOR UPDATE;
  SELECT * INTO ator FROM "Usuario" WHERE id = NEW."decisorId" FOR SHARE;
  IF NOT FOUND OR NOT ator.ativo OR NOT ('ADMINISTRADOR'::"Papel" = ANY(ator.papeis)) OR NEW."decisorId" = proposta."preparadaPorId" THEN RAISE EXCEPTION 'Decisão exige outro administrador ativo'; END IF;
  IF NEW."propostaHash" IS DISTINCT FROM proposta."entradaHash" THEN RAISE EXCEPTION 'Decisão não corresponde à proposta exata'; END IF;
  IF NEW.aprovada THEN
    IF EXISTS (SELECT 1 FROM "PropostaAditivoContratual" n WHERE n."matriculaId" = proposta."matriculaId" AND n.versao > proposta.versao) THEN RAISE EXCEPTION 'Existe proposta de aditivo mais recente'; END IF;
    PERFORM conferir_fonte_aditivo_117(proposta);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validar_decisao_aditivo_117 BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoAditivoContratual" FOR EACH ROW EXECUTE FUNCTION validar_decisao_aditivo_117();
