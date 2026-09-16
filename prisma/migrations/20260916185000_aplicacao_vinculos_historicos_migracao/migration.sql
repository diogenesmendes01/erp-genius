-- M01 / MIGRACAO 185 — PROPOSTA CONSOLIDADA PARA REVISAO. NAO APLICAR.
CREATE TYPE "ProvenienciaVinculoMatricula" AS ENUM ('MIGRACAO');

CREATE TYPE "SemanticaFimVinculoMigracao" AS ENUM ('LIMITE_EXCLUSIVO','ULTIMO_DIA_COBERTO');

CREATE TYPE "TipoFatoSituacaoMatriculaMigracao" AS ENUM ('ATIVACAO','PAUSA','ENCERRAMENTO','CANCELAMENTO');

ALTER TABLE "AlocacaoTurma" ADD COLUMN "provenienciaVinculo" "ProvenienciaVinculoMatricula", ADD COLUMN "inicioVigencia" TIMESTAMPTZ, ADD COLUMN "fimVigencia" TIMESTAMPTZ;

ALTER TABLE "AlocacaoTurma" ADD CONSTRAINT "AlocacaoTurma_vigencia_migracao_check" CHECK (COALESCE(("provenienciaVinculo" IS NULL AND "inicioVigencia" IS NULL AND "fimVigencia" IS NULL) OR ("provenienciaVinculo" IS NOT DISTINCT FROM 'MIGRACAO'::"ProvenienciaVinculoMatricula" AND "inicioVigencia" IS NOT NULL AND ("fimVigencia" IS NULL OR "fimVigencia">"inicioVigencia")),false));

CREATE TABLE "MapaOrigemMatriculaMigracao" ("id" TEXT PRIMARY KEY,"origem" TEXT NOT NULL,"matriculaOrigemId" TEXT NOT NULL,"matriculaId" TEXT NOT NULL UNIQUE,"linhaId" TEXT NOT NULL,"entradaHash" TEXT NOT NULL,"criadoPorId" TEXT NOT NULL,"criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "MapaOrigemMatriculaMigracao_origem_matricula_key" UNIQUE ("origem","matriculaOrigemId"),FOREIGN KEY("matriculaId") REFERENCES "Matricula"(id) ON DELETE RESTRICT ON UPDATE CASCADE,FOREIGN KEY("linhaId") REFERENCES "LinhaPreparacaoMigracao"(id) ON DELETE RESTRICT ON UPDATE CASCADE,FOREIGN KEY("criadoPorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE CASCADE,CHECK(length(btrim("origem"))>0 AND length(btrim("matriculaOrigemId"))>0 AND "entradaHash"~'^[0-9a-f]{64}$'));

CREATE TABLE "TermosHistoricosMatriculaMigracao" ("id" TEXT PRIMARY KEY,"matriculaId" TEXT NOT NULL UNIQUE,"linhaId" TEXT NOT NULL,"entradaHash" TEXT NOT NULL,"ensaioId" TEXT NOT NULL,"proveniencia" "ProvenienciaVinculoMatricula" NOT NULL,"diaVencimento" INTEGER NOT NULL,"mesesPlano" INTEGER NOT NULL,"evidenciaContrato" JSONB NOT NULL,"evidenciaPagamento" JSONB NOT NULL,"revisadoPorId" TEXT NOT NULL,"revisadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY("matriculaId") REFERENCES "Matricula"(id) ON DELETE RESTRICT ON UPDATE CASCADE,FOREIGN KEY("linhaId") REFERENCES "LinhaPreparacaoMigracao"(id) ON DELETE RESTRICT ON UPDATE CASCADE,FOREIGN KEY("ensaioId") REFERENCES "EnsaioVinculoMigracao"(id) ON DELETE RESTRICT ON UPDATE CASCADE,FOREIGN KEY("revisadoPorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE CASCADE,CHECK("diaVencimento" BETWEEN 1 AND 31 AND "mesesPlano">0 AND jsonb_typeof("evidenciaContrato")='object' AND "evidenciaContrato"<>'{}'::jsonb AND jsonb_typeof("evidenciaPagamento")='object' AND "evidenciaPagamento"<>'{}'::jsonb));

CREATE TABLE "FatoSituacaoMatriculaMigracao" ("id" TEXT PRIMARY KEY,"linhaId" TEXT NOT NULL,"entradaHash" TEXT NOT NULL,"contextoHash" TEXT NOT NULL,"ensaioId" TEXT NOT NULL,"matriculaId" TEXT NOT NULL,"ordem" INTEGER NOT NULL,"tipo" "TipoFatoSituacaoMatriculaMigracao" NOT NULL,"efetivoEm" TIMESTAMPTZ NOT NULL,"evidencia" JSONB NOT NULL,"conferidoPorId" TEXT NOT NULL,"conferidoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY("linhaId") REFERENCES "LinhaPreparacaoMigracao"(id) ON DELETE RESTRICT ON UPDATE CASCADE,FOREIGN KEY("ensaioId") REFERENCES "EnsaioVinculoMigracao"(id) ON DELETE RESTRICT ON UPDATE CASCADE,FOREIGN KEY("matriculaId") REFERENCES "Matricula"(id) ON DELETE RESTRICT ON UPDATE CASCADE,FOREIGN KEY("conferidoPorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE CASCADE,CONSTRAINT "FatoSituacaoMatriculaMigracao_matricula_ordem_key" UNIQUE("matriculaId","ordem"),CONSTRAINT "FatoSituacaoMatriculaMigracao_linha_hash_ordem_key" UNIQUE("linhaId","entradaHash","contextoHash","ordem"),CHECK("ordem">0 AND "entradaHash"~'^[0-9a-f]{64}$' AND "contextoHash"~'^[0-9a-f]{64}$' AND jsonb_typeof(evidencia)='object' AND evidencia<>'{}'::jsonb));

CREATE TABLE "AplicacaoVinculoMigracao" ("id" TEXT PRIMARY KEY,"linhaId" TEXT NOT NULL,"entradaHash" TEXT NOT NULL,"contextoHash" TEXT NOT NULL,"ensaioId" TEXT NOT NULL,"matriculaId" TEXT NOT NULL,"alocacaoId" TEXT NOT NULL UNIQUE,"fusoReferencia" TEXT NOT NULL,"semanticaFim" "SemanticaFimVinculoMigracao" NOT NULL,"snapshot" JSONB NOT NULL,"aplicadoPorId" TEXT NOT NULL,"aplicadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY("linhaId") REFERENCES "LinhaPreparacaoMigracao"(id) ON DELETE RESTRICT ON UPDATE CASCADE,FOREIGN KEY("ensaioId") REFERENCES "EnsaioVinculoMigracao"(id) ON DELETE RESTRICT ON UPDATE CASCADE,FOREIGN KEY("matriculaId") REFERENCES "Matricula"(id) ON DELETE RESTRICT ON UPDATE CASCADE,FOREIGN KEY("alocacaoId") REFERENCES "AlocacaoTurma"(id) ON DELETE RESTRICT ON UPDATE CASCADE,FOREIGN KEY("aplicadoPorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE CASCADE,CONSTRAINT "AplicacaoVinculoMigracao_linha_hash_key" UNIQUE("linhaId","entradaHash"),CHECK("entradaHash"~'^[0-9a-f]{64}$' AND "contextoHash"~'^[0-9a-f]{64}$' AND jsonb_typeof(snapshot)='object' AND snapshot<>'{}'::jsonb));

CREATE INDEX "MapaOrigemMatriculaMigracao_linha_idx" ON "MapaOrigemMatriculaMigracao"("linhaId");
CREATE INDEX "FatoSituacaoMatriculaMigracao_ensaio_idx" ON "FatoSituacaoMatriculaMigracao"("ensaioId");
CREATE INDEX "AplicacaoVinculoMigracao_linha_aplicado_idx" ON "AplicacaoVinculoMigracao"("linhaId","aplicadoEm");

CREATE OR REPLACE FUNCTION "alocacao_cobre_instante"(a "AlocacaoTurma", instante TIMESTAMPTZ) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$ SELECT CASE WHEN a."provenienciaVinculo" IS NOT DISTINCT FROM 'MIGRACAO'::"ProvenienciaVinculoMatricula" THEN a."inicioVigencia" IS NOT NULL AND a."inicioVigencia"<=instante AND (a.ativa OR a."fimVigencia" IS NOT NULL OR a."encerradaEm" IS NOT NULL) AND instante<COALESCE(LEAST(a."fimVigencia",a."encerradaEm" AT TIME ZONE 'UTC'),a."fimVigencia",a."encerradaEm" AT TIME ZONE 'UTC','infinity'::timestamptz) WHEN a."provenienciaVinculo" IS NULL THEN (a."criadoEm" AT TIME ZONE 'UTC')<=instante AND instante<COALESCE(a."encerradaEm" AT TIME ZONE 'UTC','infinity'::timestamptz) AND (a.ativa OR a."encerradaEm" IS NOT NULL) ELSE false END $$;

CREATE OR REPLACE FUNCTION "guard_alocacao_vigencia_migracao"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF TG_OP='UPDATE' AND (NEW."provenienciaVinculo" IS DISTINCT FROM OLD."provenienciaVinculo" OR NEW."inicioVigencia" IS DISTINCT FROM OLD."inicioVigencia" OR NEW."fimVigencia" IS DISTINCT FROM OLD."fimVigencia") THEN RAISE EXCEPTION 'Proveniência e vigência histórica são imutáveis';
 END IF;
 RETURN NEW;
 END $$;

CREATE OR REPLACE FUNCTION "guard_mapa_origem_matricula_migracao"() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE l record;
 BEGIN IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Mapa imutável';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM "Usuario" u WHERE u.id=NEW."criadoPorId" AND u.ativo AND 'ADMINISTRADOR'::"Papel"=ANY(u.papeis)) THEN RAISE EXCEPTION 'Autor inválido';
 END IF;
 SELECT x."entradaHash",x."matriculaOrigemId",x."tipoEntrada",lo.origem INTO l FROM "LinhaPreparacaoMigracao" x JOIN "LotePreparacaoMigracao" lo ON lo.id=x."loteId" WHERE x.id=NEW."linhaId" FOR KEY SHARE;
 IF NOT FOUND OR l."tipoEntrada"<>'VINCULO_MATRICULA'::"TipoEntradaPreparacaoMigracao" OR l.origem IS DISTINCT FROM NEW.origem OR l."matriculaOrigemId" IS DISTINCT FROM NEW."matriculaOrigemId" OR l."entradaHash" IS DISTINCT FROM NEW."entradaHash" THEN RAISE EXCEPTION 'Mapa fora da fotografia';
 END IF;
 RETURN NEW;
 END $$;

CREATE OR REPLACE FUNCTION "guard_termos_historicos_matricula_migracao"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Termos imutáveis'; END IF;
 IF NEW.proveniencia IS DISTINCT FROM 'MIGRACAO'::"ProvenienciaVinculoMatricula" OR NOT EXISTS(SELECT 1 FROM "Usuario" u WHERE u.id=NEW."revisadoPorId" AND u.ativo AND 'ADMINISTRADOR'::"Papel"=ANY(u.papeis)) OR NOT EXISTS(SELECT 1 FROM "EnsaioVinculoMigracao" e JOIN "LinhaPreparacaoMigracao" l ON l.id=e."linhaId" JOIN "LotePreparacaoMigracao" lo ON lo.id=l."loteId" JOIN "MapaOrigemMatriculaMigracao" mm ON mm.origem=lo.origem AND mm."matriculaOrigemId"=l."matriculaOrigemId" JOIN "Matricula" m ON m.id=mm."matriculaId" JOIN "MapaOrigemAlunoMigracao" ma ON ma.origem=lo.origem AND ma."alunoOrigemId"=l."alunoOrigemId" AND ma."alunoId"=m."alunoId" WHERE e.id=NEW."ensaioId" AND e."linhaId"=NEW."linhaId" AND e."entradaHash"=NEW."entradaHash" AND e.resultado='PRONTO_PARA_REVISAO'::"ResultadoEnsaioVinculoMigracao" AND mm."matriculaId"=NEW."matriculaId" AND m."diaVencimento"=NEW."diaVencimento" AND m."mesesPlano"=NEW."mesesPlano" AND NOT m."contratoOk" AND NOT m."pagamentoTaxaOk" AND NOT m."primeiraMensalidadeOk" AND m."ativadaEm" IS NULL) THEN RAISE EXCEPTION 'Termos não correspondem ao ensaio, mapa e contrato'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "guard_fato_situacao_matricula_migracao"() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE e record;
 anterior "FatoSituacaoMatriculaMigracao"%ROWTYPE;
 BEGIN IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Fato imutável';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM "Usuario" u WHERE u.id=NEW."conferidoPorId" AND u.ativo AND 'ADMINISTRADOR'::"Papel"=ANY(u.papeis)) THEN RAISE EXCEPTION 'Conferidor inválido';
 END IF;
 SELECT * INTO e FROM "EnsaioVinculoMigracao" WHERE id=NEW."ensaioId" FOR SHARE;
 IF NOT FOUND OR e."linhaId" IS DISTINCT FROM NEW."linhaId" OR e."entradaHash" IS DISTINCT FROM NEW."entradaHash" OR e."contextoHash" IS DISTINCT FROM NEW."contextoHash" OR e.resultado<>'PRONTO_PARA_REVISAO'::"ResultadoEnsaioVinculoMigracao" OR NOT EXISTS (SELECT 1 FROM "LinhaPreparacaoMigracao" lf JOIN "LotePreparacaoMigracao" lo ON lo.id=lf."loteId" JOIN "MapaOrigemMatriculaMigracao" mm ON mm.origem=lo.origem AND mm."matriculaOrigemId"=lf."matriculaOrigemId" JOIN "Matricula" m ON m.id=mm."matriculaId" JOIN "MapaOrigemAlunoMigracao" ma ON ma.origem=lo.origem AND ma."alunoOrigemId"=lf."alunoOrigemId" AND ma."alunoId"=m."alunoId" WHERE lf.id=NEW."linhaId" AND mm."matriculaId"=NEW."matriculaId") THEN RAISE EXCEPTION 'Fato sem contrato de origem mapeado';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('migracao-fatos:'||NEW."matriculaId",0));
 SELECT * INTO anterior FROM "FatoSituacaoMatriculaMigracao" WHERE "matriculaId"=NEW."matriculaId" ORDER BY ordem DESC LIMIT 1 FOR UPDATE;
 IF (anterior.id IS NULL AND (NEW.ordem<>1 OR NEW.tipo<>'ATIVACAO'::"TipoFatoSituacaoMatriculaMigracao")) OR (anterior.id IS NOT NULL AND (NEW.ordem<>anterior.ordem+1 OR NEW."efetivoEm"<=anterior."efetivoEm" OR (anterior.tipo='ATIVACAO' AND NEW.tipo NOT IN ('PAUSA','ENCERRAMENTO','CANCELAMENTO')) OR (anterior.tipo='PAUSA' AND NEW.tipo NOT IN ('ATIVACAO','ENCERRAMENTO','CANCELAMENTO')) OR anterior.tipo IN ('ENCERRAMENTO','CANCELAMENTO'))) THEN RAISE EXCEPTION 'Cronologia ou transição histórica inválida';
 END IF;
 RETURN NEW;
 END $$;

CREATE OR REPLACE FUNCTION "guard_aplicacao_vinculo_migracao"()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  linha record;
  ensaio record;
  alocacao record;
  termos record;
  ultimo "FatoSituacaoMatriculaMigracao"%ROWTYPE;
  status_destino "StatusMatricula";
  fonte_coincide boolean := false;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Aplicação de vínculo é imutável'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u.id=NEW."aplicadoPorId" AND u.ativo AND 'ADMINISTRADOR'::"Papel"=ANY(u.papeis)) THEN RAISE EXCEPTION 'Executor sem Administração ativa'; END IF;
  SELECT l.*, lote.origem INTO linha FROM "LinhaPreparacaoMigracao" l JOIN "LotePreparacaoMigracao" lote ON lote.id=l."loteId" WHERE l.id=NEW."linhaId" FOR KEY SHARE;
  SELECT * INTO ensaio FROM "EnsaioVinculoMigracao" WHERE id=NEW."ensaioId" FOR SHARE;
  IF NOT FOUND OR linha."tipoEntrada" IS DISTINCT FROM 'VINCULO_MATRICULA'::"TipoEntradaPreparacaoMigracao" OR linha."entradaHash" IS DISTINCT FROM NEW."entradaHash" OR ensaio."linhaId" IS DISTINCT FROM NEW."linhaId" OR ensaio."entradaHash" IS DISTINCT FROM NEW."entradaHash" OR ensaio."contextoHash" IS DISTINCT FROM NEW."contextoHash" OR ensaio.resultado IS DISTINCT FROM 'PRONTO_PARA_REVISAO'::"ResultadoEnsaioVinculoMigracao" THEN RAISE EXCEPTION 'Fotografia ou ensaio não corresponde à aplicação'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('migracao-produto:'||linha.origem||':'||COALESCE(NULLIF(btrim(linha."dadosOrigem" #>> '{matricula,produtoOrigem}'),''),'<ausente>'),0));
  PERFORM pg_advisory_xact_lock(hashtextextended('migracao-turma:'||linha.origem||':'||COALESCE(linha."turmaOrigemId",'<ausente>'),0));
  PERFORM pg_advisory_xact_lock(hashtextextended('migracao-status-matricula:'||linha.origem||':'||COALESCE(NULLIF(btrim(linha."dadosOrigem" #>> '{matricula,situacao}'),''),'<ausente>'),0));
  PERFORM pp."produtoId" FROM "CorrespondenciaProdutoMigracao" c JOIN "ProdutoPais" pp ON pp."produtoId"=c."produtoId" AND pp."paisId"=c."paisId" AND pp.moeda=c.moeda WHERE c.id=ensaio."correspondenciaProdutoId" FOR SHARE;
IF NOT EXISTS (SELECT 1 FROM "CorrespondenciaProdutoMigracao" c JOIN "ProdutoPais" pp ON pp."produtoId"=c."produtoId" AND pp."paisId"=c."paisId" AND pp.moeda=c.moeda AND pp.oferecido WHERE c.id=ensaio."correspondenciaProdutoId" AND c.ativa AND c.origem=linha.origem AND c."produtoOrigemId"=NULLIF(btrim(linha."dadosOrigem" #>> '{matricula,produtoOrigem}'),'') AND NOT EXISTS (SELECT 1 FROM "CorrespondenciaProdutoMigracao" n WHERE n.origem=c.origem AND n."produtoOrigemId"=c."produtoOrigemId" AND n.versao>c.versao)) THEN RAISE EXCEPTION 'Correspondência de produto não é vigente ou ofertada'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "CorrespondenciaTurmaMigracao" c WHERE c.id=ensaio."correspondenciaTurmaId" AND c.ativa AND c.origem=linha.origem AND c."turmaOrigemId"=linha."turmaOrigemId" AND NOT EXISTS (SELECT 1 FROM "CorrespondenciaTurmaMigracao" n WHERE n.origem=c.origem AND n."turmaOrigemId"=c."turmaOrigemId" AND n.versao>c.versao)) THEN RAISE EXCEPTION 'Correspondência de turma não é vigente'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "CorrespondenciaStatusMatriculaMigracao" c WHERE c.id=ensaio."correspondenciaStatusId" AND c.ativa AND c.origem=linha.origem AND c."statusOrigem"=NULLIF(btrim(linha."dadosOrigem" #>> '{matricula,situacao}'),'') AND NOT EXISTS (SELECT 1 FROM "CorrespondenciaStatusMatriculaMigracao" n WHERE n.origem=c.origem AND n."statusOrigem"=c."statusOrigem" AND n.versao>c.versao)) THEN RAISE EXCEPTION 'Correspondência de situação não é vigente'; END IF;
  SELECT * INTO alocacao FROM "AlocacaoTurma" WHERE id=NEW."alocacaoId" FOR SHARE;
  SELECT * INTO termos FROM "TermosHistoricosMatriculaMigracao" WHERE "matriculaId"=NEW."matriculaId" FOR SHARE;
  SELECT * INTO ultimo FROM "FatoSituacaoMatriculaMigracao" WHERE "matriculaId"=NEW."matriculaId" ORDER BY ordem DESC LIMIT 1;
  SELECT c."statusDestino" INTO status_destino FROM "CorrespondenciaStatusMatriculaMigracao" c WHERE c.id=ensaio."correspondenciaStatusId";
  IF NOT EXISTS (SELECT 1 FROM "MapaOrigemMatriculaMigracao" mm JOIN "Matricula" m ON m.id=mm."matriculaId" JOIN "MapaOrigemAlunoMigracao" ma ON ma."alunoId"=m."alunoId" WHERE mm.origem=linha.origem AND mm."matriculaOrigemId"=linha."matriculaOrigemId" AND mm."matriculaId"=NEW."matriculaId" AND ma.origem=linha.origem AND ma."alunoOrigemId"=linha."alunoOrigemId") OR NOT EXISTS (SELECT 1 FROM "Matricula" m JOIN "CorrespondenciaProdutoMigracao" c ON c.id=ensaio."correspondenciaProdutoId" WHERE m.id=NEW."matriculaId" AND m."produtoId"=c."produtoId" AND m."paisId"=c."paisId" AND m.moeda=c.moeda) OR alocacao."matriculaId" IS DISTINCT FROM NEW."matriculaId" OR alocacao."provenienciaVinculo" IS DISTINCT FROM 'MIGRACAO'::"ProvenienciaVinculoMatricula" OR alocacao."inicioVigencia" IS NULL OR (status_destino IN ('ENCERRADA'::"StatusMatricula",'CANCELADA'::"StatusMatricula") AND alocacao."fimVigencia" IS NULL) OR NOT EXISTS (SELECT 1 FROM "CorrespondenciaTurmaMigracao" c WHERE c.id=ensaio."correspondenciaTurmaId" AND c."turmaId"=alocacao."turmaId") THEN RAISE EXCEPTION 'Identidade ou destino não corresponde ao ensaio'; END IF;
  IF ultimo.id IS NULL OR NOT EXISTS (SELECT 1 FROM "FatoSituacaoMatriculaMigracao" f JOIN "LinhaPreparacaoMigracao" lf ON lf.id=f."linhaId" JOIN "LotePreparacaoMigracao" lo ON lo.id=lf."loteId" JOIN "MapaOrigemMatriculaMigracao" mm ON mm.origem=lo.origem AND mm."matriculaOrigemId"=lf."matriculaOrigemId" JOIN "Matricula" m ON m.id=mm."matriculaId" JOIN "MapaOrigemAlunoMigracao" ma ON ma.origem=lo.origem AND ma."alunoOrigemId"=lf."alunoOrigemId" AND ma."alunoId"=m."alunoId" WHERE f.id=ultimo.id AND mm."matriculaId"=NEW."matriculaId") OR (SELECT status FROM "Matricula" WHERE id=NEW."matriculaId") IS DISTINCT FROM status_destino OR (CASE ultimo.tipo WHEN 'ATIVACAO'::"TipoFatoSituacaoMatriculaMigracao" THEN 'ATIVA'::"StatusMatricula" WHEN 'PAUSA'::"TipoFatoSituacaoMatriculaMigracao" THEN 'PAUSADA'::"StatusMatricula" WHEN 'ENCERRAMENTO'::"TipoFatoSituacaoMatriculaMigracao" THEN 'ENCERRADA'::"StatusMatricula" WHEN 'CANCELAMENTO'::"TipoFatoSituacaoMatriculaMigracao" THEN 'CANCELADA'::"StatusMatricula" END) IS DISTINCT FROM status_destino THEN RAISE EXCEPTION 'Último fato não comprova o estado do ensaio'; END IF;
  IF termos.id IS NULL OR NEW.snapshot->>'linhaId' IS DISTINCT FROM NEW."linhaId" OR NEW.snapshot->>'entradaHash' IS DISTINCT FROM NEW."entradaHash" OR NEW.snapshot->>'contextoHash' IS DISTINCT FROM NEW."contextoHash" OR NEW.snapshot->>'fusoReferencia' IS DISTINCT FROM NEW."fusoReferencia" OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name=NEW."fusoReferencia") OR NOT (NEW.snapshot ? 'limites') OR NOT ((NEW.snapshot->'limites') ? 'inicioVigencia') OR NOT ((NEW.snapshot->'limites') ? 'fimVigencia') OR ((NEW.snapshot #>> '{limites,inicioVigencia}')::timestamptz IS DISTINCT FROM alocacao."inicioVigencia") OR ((NEW.snapshot #>> '{limites,fimVigencia}')::timestamptz IS DISTINCT FROM alocacao."fimVigencia") OR NEW.snapshot #>> '{termos,diaVencimento}' IS DISTINCT FROM termos."diaVencimento"::text OR NEW.snapshot #>> '{termos,mesesPlano}' IS DISTINCT FROM termos."mesesPlano"::text OR NEW.snapshot #> '{evidencias,contrato}' IS DISTINCT FROM termos."evidenciaContrato" OR NEW.snapshot #> '{evidencias,pagamento}' IS DISTINCT FROM termos."evidenciaPagamento" OR NEW.snapshot->>'semanticaFim' IS DISTINCT FROM NEW."semanticaFim"::text THEN RAISE EXCEPTION 'Snapshot não reproduz limites, termos, evidências e semântica aplicados'; END IF;
  -- Uma diferença da fotografia exige complemento documental desta participação.
  BEGIN
    fonte_coincide := COALESCE(
    (linha."dadosOrigem" #>> '{alocacao,inicio}') ~ '^\d{4}-\d{2}-\d{2}$'
    AND ((linha."dadosOrigem" #>> '{alocacao,inicio}')::date::timestamp AT TIME ZONE NEW."fusoReferencia") = alocacao."inicioVigencia"
    AND CASE WHEN NULLIF(btrim(linha."dadosOrigem" #>> '{alocacao,fim}'),'') IS NULL
      THEN alocacao."fimVigencia" IS NULL
      ELSE ((linha."dadosOrigem" #>> '{alocacao,fim}')::date::timestamp
        + CASE WHEN NEW."semanticaFim"='ULTIMO_DIA_COBERTO' THEN interval '1 day' ELSE interval '0 day' END
      ) AT TIME ZONE NEW."fusoReferencia" IS NOT DISTINCT FROM alocacao."fimVigencia"
    END, false);
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    fonte_coincide := false;
  END;
  IF NOT fonte_coincide THEN
    IF NOT COALESCE(
      jsonb_typeof(NEW.snapshot->'complementoVigencia')='object'
      AND length(btrim(NEW.snapshot #>> '{complementoVigencia,motivo}'))>=10
      AND jsonb_typeof(NEW.snapshot #> '{complementoVigencia,evidencia}')='object'
      AND (NEW.snapshot #> '{complementoVigencia,evidencia}')<>'{}'::jsonb, false)
    THEN RAISE EXCEPTION 'Vigência diverge da origem sem complemento documental desta participação'; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "guard_alocacao_vigencia_migracao" BEFORE UPDATE ON "AlocacaoTurma" FOR EACH ROW EXECUTE FUNCTION "guard_alocacao_vigencia_migracao"();

CREATE TRIGGER "guard_mapa_origem_matricula_migracao" BEFORE INSERT OR UPDATE OR DELETE ON "MapaOrigemMatriculaMigracao" FOR EACH ROW EXECUTE FUNCTION "guard_mapa_origem_matricula_migracao"();

CREATE TRIGGER "guard_termos_historicos_matricula_migracao" BEFORE INSERT OR UPDATE OR DELETE ON "TermosHistoricosMatriculaMigracao" FOR EACH ROW EXECUTE FUNCTION "guard_termos_historicos_matricula_migracao"();

CREATE TRIGGER "guard_fato_situacao_matricula_migracao" BEFORE INSERT OR UPDATE OR DELETE ON "FatoSituacaoMatriculaMigracao" FOR EACH ROW EXECUTE FUNCTION "guard_fato_situacao_matricula_migracao"();

CREATE TRIGGER "guard_aplicacao_vinculo_migracao" BEFORE INSERT OR UPDATE OR DELETE ON "AplicacaoVinculoMigracao" FOR EACH ROW EXECUTE FUNCTION "guard_aplicacao_vinculo_migracao"();





