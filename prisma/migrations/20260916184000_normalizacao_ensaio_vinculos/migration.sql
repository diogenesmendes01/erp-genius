-- PROPOSTA PARA MIGRACAO 184 RESERVADA; NAO APLICAR SEM REVISAO
-- Normaliza somente chaves textuais de produto/status da fotografia no guard append-only.
CREATE OR REPLACE FUNCTION "guard_ensaio_vinculo_migracao"()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE linha RECORD; produto RECORD; turma RECORD; status_matricula RECORD; produto_origem text; status_origem text;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Ensaio de vínculo é append-only'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u.id = NEW."ensaiadoPorId" AND u.ativo AND 'ADMINISTRADOR'::"Papel" = ANY(u.papeis)) THEN RAISE EXCEPTION 'Executor sem papel Administração ativo'; END IF;
  SELECT l.id, l."entradaHash", l."tipoEntrada", l."turmaOrigemId", l."dadosOrigem", lote.origem INTO linha FROM "LinhaPreparacaoMigracao" l JOIN "LotePreparacaoMigracao" lote ON lote.id = l."loteId" WHERE l.id = NEW."linhaId" FOR KEY SHARE;
  IF NOT FOUND OR linha."tipoEntrada" IS DISTINCT FROM 'VINCULO_MATRICULA'::"TipoEntradaPreparacaoMigracao" OR linha."entradaHash" IS DISTINCT FROM NEW."entradaHash" THEN RAISE EXCEPTION 'Ensaio não corresponde à fotografia de vínculo atual'; END IF;
  produto_origem := NULLIF(btrim(linha."dadosOrigem" #>> '{matricula,produtoOrigem}'), '');
  status_origem := NULLIF(btrim(linha."dadosOrigem" #>> '{matricula,situacao}'), '');
  -- A revisão e o ensaio usam as mesmas chaves de advisory lock: a fotografia não
  -- pode ser aceita entre a leitura de uma versão e a sua revogação concorrente.
  PERFORM pg_advisory_xact_lock(hashtextextended('migracao-produto:' || linha.origem || ':' || COALESCE(produto_origem, '<ausente>'), 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('migracao-turma:' || linha.origem || ':' || COALESCE(linha."turmaOrigemId", '<ausente>'), 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('migracao-status-matricula:' || linha.origem || ':' || COALESCE(status_origem, '<ausente>'), 0));  IF jsonb_typeof(NEW.snapshot) IS DISTINCT FROM 'object' OR NEW.snapshot->>'linhaId' IS DISTINCT FROM NEW."linhaId" OR NEW.snapshot->>'entradaHash' IS DISTINCT FROM NEW."entradaHash" OR NEW.snapshot->>'contextoHash' IS DISTINCT FROM NEW."contextoHash" OR jsonb_typeof(NEW.snapshot->'correspondencias') IS DISTINCT FROM 'object' OR NOT (NEW.snapshot->'correspondencias' ?& ARRAY['produto','turma','status']) THEN RAISE EXCEPTION 'Snapshot de ensaio inválido ou incompleto'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.requisitos) requisito WHERE jsonb_typeof(requisito) IS DISTINCT FROM 'object' OR length(btrim(COALESCE(requisito->>'codigo', ''))) = 0) THEN RAISE EXCEPTION 'Requisitos de ensaio inválidos'; END IF;

  IF NEW."correspondenciaProdutoId" IS NULL THEN
    IF jsonb_typeof(NEW.snapshot #> '{correspondencias,produto}') IS DISTINCT FROM 'null' THEN RAISE EXCEPTION 'Snapshot de produto deve declarar ausência'; END IF;
  ELSE
    SELECT * INTO produto FROM "CorrespondenciaProdutoMigracao" WHERE id = NEW."correspondenciaProdutoId";
    IF NOT FOUND OR produto.origem <> linha.origem OR produto."produtoOrigemId" IS DISTINCT FROM (produto_origem) OR NOT produto.ativa OR EXISTS (SELECT 1 FROM "CorrespondenciaProdutoMigracao" nova WHERE nova.origem = produto.origem AND nova."produtoOrigemId" = produto."produtoOrigemId" AND nova.versao > produto.versao) OR NOT EXISTS (SELECT 1 FROM "ProdutoPais" pp WHERE pp."produtoId" = produto."produtoId" AND pp."paisId" = produto."paisId" AND pp.moeda = produto.moeda AND pp.oferecido) OR NEW.snapshot #>> '{correspondencias,produto,id}' IS DISTINCT FROM produto.id OR (NEW.snapshot #>> '{correspondencias,produto,versao}')::integer IS DISTINCT FROM produto.versao THEN RAISE EXCEPTION 'Referência de produto não é a versão vigente e disponível'; END IF;
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
    IF NOT FOUND OR status_matricula.origem <> linha.origem OR status_matricula."statusOrigem" IS DISTINCT FROM (status_origem) OR NOT status_matricula.ativa OR EXISTS (SELECT 1 FROM "CorrespondenciaStatusMatriculaMigracao" nova WHERE nova.origem = status_matricula.origem AND nova."statusOrigem" = status_matricula."statusOrigem" AND nova.versao > status_matricula.versao) OR NEW.snapshot #>> '{correspondencias,status,id}' IS DISTINCT FROM status_matricula.id OR (NEW.snapshot #>> '{correspondencias,status,versao}')::integer IS DISTINCT FROM status_matricula.versao THEN RAISE EXCEPTION 'Referência de estado não é a versão vigente'; END IF;
  END IF;
  IF NEW.resultado = 'PRONTO_PARA_REVISAO' THEN
    -- Pronto para revisão não é pronto para efetivação: pode conservar requisitos
    -- contratuais/financeiros explícitos, mas já exige as três correspondências.
    IF NEW."correspondenciaProdutoId" IS NULL OR NEW."correspondenciaTurmaId" IS NULL OR NEW."correspondenciaStatusId" IS NULL THEN RAISE EXCEPTION 'Ensaio para revisão exige correspondências completas'; END IF;
  ELSIF jsonb_array_length(NEW.requisitos) = 0 THEN RAISE EXCEPTION 'Ensaio não pronto deve declarar requisitos ou divergências'; END IF;
  RETURN NEW;
END $$;
