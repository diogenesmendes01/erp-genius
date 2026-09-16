-- M01 / migration 183 (PROPOSTA: não aplicar sem revisão do integrador)
-- Correspondências são fatos administrativos versionados. A versão mais recente de
-- cada chave é a única vigente; uma revisão ativa=false revoga a chave, sem fazer
-- uma versão anterior voltar a valer.

CREATE TYPE "ResultadoEnsaioVinculoMigracao" AS ENUM (
  'REQUISITO_AUSENTE',
  'PRONTO_PARA_REVISAO',
  'DIVERGENTE'
);

CREATE TABLE "CorrespondenciaProdutoMigracao" (
  "id" TEXT NOT NULL,
  "origem" TEXT NOT NULL,
  "produtoOrigemId" TEXT NOT NULL,
  "versao" INTEGER NOT NULL,
  "produtoId" TEXT NOT NULL,
  "paisId" TEXT NOT NULL,
  "moeda" TEXT NOT NULL,
  "ativa" BOOLEAN NOT NULL,
  "revisadaPorId" TEXT NOT NULL,
  "revisadaEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CorrespondenciaProdutoMigracao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CorrespondenciaProdutoMigracao_origem_produto_versao_key" UNIQUE ("origem", "produtoOrigemId", "versao"),
  CONSTRAINT "CorrespondenciaProdutoMigracao_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CorrespondenciaProdutoMigracao_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "Pais"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CorrespondenciaProdutoMigracao_revisadaPorId_fkey" FOREIGN KEY ("revisadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CorrespondenciaProdutoMigracao_versao_check" CHECK ("versao" > 0),
  CONSTRAINT "CorrespondenciaProdutoMigracao_origem_check" CHECK (length(btrim("origem")) > 0),
  CONSTRAINT "CorrespondenciaProdutoMigracao_produto_origem_check" CHECK (length(btrim("produtoOrigemId")) > 0),
  CONSTRAINT "CorrespondenciaProdutoMigracao_moeda_check" CHECK ("moeda" ~ '^[A-Z]{3}$')
);

CREATE TABLE "CorrespondenciaTurmaMigracao" (
  "id" TEXT NOT NULL,
  "origem" TEXT NOT NULL,
  "turmaOrigemId" TEXT NOT NULL,
  "versao" INTEGER NOT NULL,
  "turmaId" TEXT NOT NULL,
  "ativa" BOOLEAN NOT NULL,
  "revisadaPorId" TEXT NOT NULL,
  "revisadaEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CorrespondenciaTurmaMigracao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CorrespondenciaTurmaMigracao_origem_turma_versao_key" UNIQUE ("origem", "turmaOrigemId", "versao"),
  CONSTRAINT "CorrespondenciaTurmaMigracao_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CorrespondenciaTurmaMigracao_revisadaPorId_fkey" FOREIGN KEY ("revisadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CorrespondenciaTurmaMigracao_versao_check" CHECK ("versao" > 0),
  CONSTRAINT "CorrespondenciaTurmaMigracao_origem_check" CHECK (length(btrim("origem")) > 0),
  CONSTRAINT "CorrespondenciaTurmaMigracao_turma_origem_check" CHECK (length(btrim("turmaOrigemId")) > 0)
);

CREATE TABLE "CorrespondenciaStatusMatriculaMigracao" (
  "id" TEXT NOT NULL,
  "origem" TEXT NOT NULL,
  "statusOrigem" TEXT NOT NULL,
  "versao" INTEGER NOT NULL,
  "statusDestino" "StatusMatricula" NOT NULL,
  "ativa" BOOLEAN NOT NULL,
  "revisadaPorId" TEXT NOT NULL,
  "revisadaEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CorrespondenciaStatusMatriculaMigracao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CorrespondenciaStatusMatriculaMigracao_origem_status_versao_key" UNIQUE ("origem", "statusOrigem", "versao"),
  CONSTRAINT "CorrespondenciaStatusMatriculaMigracao_revisadaPorId_fkey" FOREIGN KEY ("revisadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CorrespondenciaStatusMatriculaMigracao_versao_check" CHECK ("versao" > 0),
  CONSTRAINT "CorrespondenciaStatusMatriculaMigracao_origem_check" CHECK (length(btrim("origem")) > 0),
  CONSTRAINT "CorrespondenciaStatusMatriculaMigracao_status_origem_check" CHECK (length(btrim("statusOrigem")) > 0)
);

-- Um ensaio referencia a linha/fotografia e as versões exatas usadas na decisão.
-- contextoHash é SHA-256 calculado pelo servidor sobre linha, hash, IDs/versões,
-- alvos e evidências atuais; a constraint permite novo ensaio apenas se esse contexto mudar.
CREATE TABLE "EnsaioVinculoMigracao" (
  "id" TEXT NOT NULL,
  "linhaId" TEXT NOT NULL,
  "entradaHash" TEXT NOT NULL,
  "contextoHash" TEXT NOT NULL,
  "resultado" "ResultadoEnsaioVinculoMigracao" NOT NULL,
  "requisitos" JSONB NOT NULL,
  "snapshot" JSONB NOT NULL,
  "correspondenciaProdutoId" TEXT,
  "correspondenciaTurmaId" TEXT,
  "correspondenciaStatusId" TEXT,
  "ensaiadoPorId" TEXT NOT NULL,
  "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnsaioVinculoMigracao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EnsaioVinculoMigracao_contexto_key" UNIQUE ("linhaId", "entradaHash", "contextoHash"),
  CONSTRAINT "EnsaioVinculoMigracao_linhaId_fkey" FOREIGN KEY ("linhaId") REFERENCES "LinhaPreparacaoMigracao"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EnsaioVinculoMigracao_correspondenciaProdutoId_fkey" FOREIGN KEY ("correspondenciaProdutoId") REFERENCES "CorrespondenciaProdutoMigracao"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EnsaioVinculoMigracao_correspondenciaTurmaId_fkey" FOREIGN KEY ("correspondenciaTurmaId") REFERENCES "CorrespondenciaTurmaMigracao"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EnsaioVinculoMigracao_correspondenciaStatusId_fkey" FOREIGN KEY ("correspondenciaStatusId") REFERENCES "CorrespondenciaStatusMatriculaMigracao"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EnsaioVinculoMigracao_ensaiadoPorId_fkey" FOREIGN KEY ("ensaiadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EnsaioVinculoMigracao_hashes_check" CHECK ("entradaHash" ~ '^[0-9a-f]{64}$' AND "contextoHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "EnsaioVinculoMigracao_requisitos_array_check" CHECK (jsonb_typeof("requisitos") = 'array'),
  CONSTRAINT "EnsaioVinculoMigracao_snapshot_object_check" CHECK (jsonb_typeof("snapshot") = 'object')
);
CREATE INDEX "EnsaioVinculoMigracao_linhaId_criadoEm_idx" ON "EnsaioVinculoMigracao"("linhaId", "criadoEm");

CREATE OR REPLACE FUNCTION "guard_correspondencia_produto_migracao"()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ultima_versao INTEGER;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Correspondência de produto é append-only'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u.id = NEW."revisadaPorId" AND u.ativo AND 'ADMINISTRADOR'::"Papel" = ANY(u.papeis)) THEN RAISE EXCEPTION 'Revisor sem papel Administração ativo'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('migracao-produto:' || NEW.origem || ':' || NEW."produtoOrigemId", 0));
  SELECT max(versao) INTO ultima_versao FROM "CorrespondenciaProdutoMigracao" WHERE origem = NEW.origem AND "produtoOrigemId" = NEW."produtoOrigemId";
  IF NEW.versao <> COALESCE(ultima_versao, 0) + 1 THEN RAISE EXCEPTION 'Versão de produto deve avançar sequencialmente'; END IF;
  IF NEW.ativa AND NOT EXISTS (SELECT 1 FROM "ProdutoPais" pp WHERE pp."produtoId" = NEW."produtoId" AND pp."paisId" = NEW."paisId" AND pp.moeda = NEW.moeda AND pp.oferecido) THEN RAISE EXCEPTION 'Produto, país ou moeda não está atualmente oferecido'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "guard_correspondencia_turma_migracao"()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ultima_versao INTEGER;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Correspondência de turma é append-only'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u.id = NEW."revisadaPorId" AND u.ativo AND 'ADMINISTRADOR'::"Papel" = ANY(u.papeis)) THEN RAISE EXCEPTION 'Revisor sem papel Administração ativo'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('migracao-turma:' || NEW.origem || ':' || NEW."turmaOrigemId", 0));
  SELECT max(versao) INTO ultima_versao FROM "CorrespondenciaTurmaMigracao" WHERE origem = NEW.origem AND "turmaOrigemId" = NEW."turmaOrigemId";
  IF NEW.versao <> COALESCE(ultima_versao, 0) + 1 THEN RAISE EXCEPTION 'Versão de turma deve avançar sequencialmente'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "guard_correspondencia_status_migracao"()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ultima_versao INTEGER;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Correspondência de estado é append-only'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u.id = NEW."revisadaPorId" AND u.ativo AND 'ADMINISTRADOR'::"Papel" = ANY(u.papeis)) THEN RAISE EXCEPTION 'Revisor sem papel Administração ativo'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('migracao-status-matricula:' || NEW.origem || ':' || NEW."statusOrigem", 0));
  SELECT max(versao) INTO ultima_versao FROM "CorrespondenciaStatusMatriculaMigracao" WHERE origem = NEW.origem AND "statusOrigem" = NEW."statusOrigem";
  IF NEW.versao <> COALESCE(ultima_versao, 0) + 1 THEN RAISE EXCEPTION 'Versão de estado deve avançar sequencialmente'; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "guard_correspondencia_produto_vinculo_migracao" BEFORE INSERT OR UPDATE OR DELETE ON "CorrespondenciaProdutoMigracao" FOR EACH ROW EXECUTE FUNCTION "guard_correspondencia_produto_migracao"();
CREATE TRIGGER "guard_correspondencia_turma_vinculo_migracao" BEFORE INSERT OR UPDATE OR DELETE ON "CorrespondenciaTurmaMigracao" FOR EACH ROW EXECUTE FUNCTION "guard_correspondencia_turma_migracao"();
CREATE TRIGGER "guard_correspondencia_status_vinculo_migracao" BEFORE INSERT OR UPDATE OR DELETE ON "CorrespondenciaStatusMatriculaMigracao" FOR EACH ROW EXECUTE FUNCTION "guard_correspondencia_status_migracao"();

CREATE OR REPLACE FUNCTION "guard_ensaio_vinculo_migracao"()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE linha RECORD; produto RECORD; turma RECORD; status_matricula RECORD;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Ensaio de vínculo é append-only'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u.id = NEW."ensaiadoPorId" AND u.ativo AND 'ADMINISTRADOR'::"Papel" = ANY(u.papeis)) THEN RAISE EXCEPTION 'Executor sem papel Administração ativo'; END IF;
  SELECT l.id, l."entradaHash", l."tipoEntrada", l."turmaOrigemId", l."dadosOrigem", lote.origem INTO linha FROM "LinhaPreparacaoMigracao" l JOIN "LotePreparacaoMigracao" lote ON lote.id = l."loteId" WHERE l.id = NEW."linhaId" FOR KEY SHARE;
  IF NOT FOUND OR linha."tipoEntrada" IS DISTINCT FROM 'VINCULO_MATRICULA'::"TipoEntradaPreparacaoMigracao" OR linha."entradaHash" IS DISTINCT FROM NEW."entradaHash" THEN RAISE EXCEPTION 'Ensaio não corresponde à fotografia de vínculo atual'; END IF;
  -- A revisão e o ensaio usam as mesmas chaves de advisory lock: a fotografia não
  -- pode ser aceita entre a leitura de uma versão e a sua revogação concorrente.
  PERFORM pg_advisory_xact_lock(hashtextextended('migracao-produto:' || linha.origem || ':' || COALESCE(linha."dadosOrigem" #>> '{matricula,produtoOrigem}', '<ausente>'), 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('migracao-turma:' || linha.origem || ':' || COALESCE(linha."turmaOrigemId", '<ausente>'), 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('migracao-status-matricula:' || linha.origem || ':' || COALESCE(linha."dadosOrigem" #>> '{matricula,situacao}', '<ausente>'), 0));  IF jsonb_typeof(NEW.snapshot) IS DISTINCT FROM 'object' OR NEW.snapshot->>'linhaId' IS DISTINCT FROM NEW."linhaId" OR NEW.snapshot->>'entradaHash' IS DISTINCT FROM NEW."entradaHash" OR NEW.snapshot->>'contextoHash' IS DISTINCT FROM NEW."contextoHash" OR jsonb_typeof(NEW.snapshot->'correspondencias') IS DISTINCT FROM 'object' OR NOT (NEW.snapshot->'correspondencias' ?& ARRAY['produto','turma','status']) THEN RAISE EXCEPTION 'Snapshot de ensaio inválido ou incompleto'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.requisitos) requisito WHERE jsonb_typeof(requisito) IS DISTINCT FROM 'object' OR length(btrim(COALESCE(requisito->>'codigo', ''))) = 0) THEN RAISE EXCEPTION 'Requisitos de ensaio inválidos'; END IF;

  IF NEW."correspondenciaProdutoId" IS NULL THEN
    IF jsonb_typeof(NEW.snapshot #> '{correspondencias,produto}') IS DISTINCT FROM 'null' THEN RAISE EXCEPTION 'Snapshot de produto deve declarar ausência'; END IF;
  ELSE
    SELECT * INTO produto FROM "CorrespondenciaProdutoMigracao" WHERE id = NEW."correspondenciaProdutoId";
    IF NOT FOUND OR produto.origem <> linha.origem OR produto."produtoOrigemId" IS DISTINCT FROM (linha."dadosOrigem" #>> '{matricula,produtoOrigem}') OR NOT produto.ativa OR EXISTS (SELECT 1 FROM "CorrespondenciaProdutoMigracao" nova WHERE nova.origem = produto.origem AND nova."produtoOrigemId" = produto."produtoOrigemId" AND nova.versao > produto.versao) OR NOT EXISTS (SELECT 1 FROM "ProdutoPais" pp WHERE pp."produtoId" = produto."produtoId" AND pp."paisId" = produto."paisId" AND pp.moeda = produto.moeda AND pp.oferecido) OR NEW.snapshot #>> '{correspondencias,produto,id}' IS DISTINCT FROM produto.id OR (NEW.snapshot #>> '{correspondencias,produto,versao}')::integer IS DISTINCT FROM produto.versao THEN RAISE EXCEPTION 'Referência de produto não é a versão vigente e disponível'; END IF;
  END IF;
  IF NEW."correspondenciaTurmaId" IS NULL THEN
    IF jsonb_typeof(NEW.snapshot #> '{correspondencias,turma}') IS DISTINCT FROM 'null' THEN RAISE EXCEPTION 'Snapshot de turma deve declarar ausência'; END IF;
  ELSE
    SELECT * INTO turma FROM "CorrespondenciaTurmaMigracao" WHERE id = NEW."correspondenciaTurmaId";
    IF NOT FOUND OR turma.origem <> linha.origem OR turma."turmaOrigemId" IS DISTINCT FROM linha."turmaOrigemId" OR NOT turma.ativa OR EXISTS (SELECT 1 FROM "CorrespondenciaTurmaMigracao" nova WHERE nova.origem = turma.origem AND nova."turmaOrigemId" = turma."turmaOrigemId" AND nova.versao > turma.versao) OR NEW.snapshot #>> '{correspondencias,turma,id}' IS DISTINCT FROM turma.id OR (NEW.snapshot #>> '{correspondencias,turma,versao}')::integer IS DISTINCT FROM turma.versao THEN RAISE EXCEPTION 'Referência de turma não é a versão vigente'; END IF;
  END IF;
  IF NEW."correspondenciaStatusId" IS NULL THEN
    IF jsonb_typeof(NEW.snapshot #> '{correspondencias,status}') IS DISTINCT FROM 'null' THEN RAISE EXCEPTION 'Snapshot de estado deve declarar ausência'; END IF;
  ELSE
    SELECT * INTO status_matricula FROM "CorrespondenciaStatusMatriculaMigracao" WHERE id = NEW."correspondenciaStatusId";
    IF NOT FOUND OR status_matricula.origem <> linha.origem OR status_matricula."statusOrigem" IS DISTINCT FROM (linha."dadosOrigem" #>> '{matricula,situacao}') OR NOT status_matricula.ativa OR EXISTS (SELECT 1 FROM "CorrespondenciaStatusMatriculaMigracao" nova WHERE nova.origem = status_matricula.origem AND nova."statusOrigem" = status_matricula."statusOrigem" AND nova.versao > status_matricula.versao) OR NEW.snapshot #>> '{correspondencias,status,id}' IS DISTINCT FROM status_matricula.id OR (NEW.snapshot #>> '{correspondencias,status,versao}')::integer IS DISTINCT FROM status_matricula.versao THEN RAISE EXCEPTION 'Referência de estado não é a versão vigente'; END IF;
  END IF;
  IF NEW.resultado = 'PRONTO_PARA_REVISAO' THEN
    -- Pronto para revisão não é pronto para efetivação: pode conservar requisitos
    -- contratuais/financeiros explícitos, mas já exige as três correspondências.
    IF NEW."correspondenciaProdutoId" IS NULL OR NEW."correspondenciaTurmaId" IS NULL OR NEW."correspondenciaStatusId" IS NULL THEN RAISE EXCEPTION 'Ensaio para revisão exige correspondências completas'; END IF;
  ELSIF jsonb_array_length(NEW.requisitos) = 0 THEN RAISE EXCEPTION 'Ensaio não pronto deve declarar requisitos ou divergências'; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "guard_ensaio_vinculo_migracao" BEFORE INSERT OR UPDATE OR DELETE ON "EnsaioVinculoMigracao" FOR EACH ROW EXECUTE FUNCTION "guard_ensaio_vinculo_migracao"();


