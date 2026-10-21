-- M01/203. Presença histórica só pode complementar uma AulaDiario existente.
CREATE TYPE "StatusPropostaPresencaHistoricaMigracao" AS ENUM ('PENDENTE','APROVADA','REJEITADA','APLICADA','PENDENCIA_CORRECAO');
CREATE TYPE "ResultadoAplicacaoPresencaHistoricaMigracao" AS ENUM ('NOVO_REGISTRO','VINCULO_EXISTENTE','DIVERGENCIA');

CREATE TABLE "PropostaPresencaHistoricaMigracao" (
  id text PRIMARY KEY, origem text NOT NULL, "presencaOrigemId" text NOT NULL, versao integer NOT NULL,
  "linhaId" text NOT NULL REFERENCES "LinhaPreparacaoMigracao"(id) ON DELETE RESTRICT,
  "mapaMatriculaId" text NOT NULL REFERENCES "MapaOrigemMatriculaMigracao"(id) ON DELETE RESTRICT,
  "matriculaId" text NOT NULL REFERENCES "Matricula"(id) ON DELETE RESTRICT,
  "aulaId" text NOT NULL REFERENCES "AulaDiario"(id) ON DELETE RESTRICT,
  participacao "ParticipacaoAula" NOT NULL, evidencia jsonb NOT NULL, entrada jsonb NOT NULL, snapshot jsonb NOT NULL,
  "entradaHash" text NOT NULL, "estadoHash" text NOT NULL, "chaveIdempotencia" text NOT NULL,
  "preparadorId" text NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT,
  "decisorId" text REFERENCES "Usuario"(id) ON DELETE RESTRICT, "chaveDecisao" text, "decisaoHash" text, "motivoDecisao" text,
  status "StatusPropostaPresencaHistoricaMigracao" NOT NULL DEFAULT 'PENDENTE', "decididoEm" timestamptz(6), "aplicadaEm" timestamptz(6), "criadoEm" timestamptz(6) NOT NULL DEFAULT now(),
  UNIQUE(origem,"presencaOrigemId",versao), UNIQUE("preparadorId","chaveIdempotencia"), UNIQUE("decisorId","chaveDecisao"),
  CHECK (versao>0 AND participacao IN ('PRESENTE','FALTA') AND length(btrim(origem))>0 AND length(btrim("presencaOrigemId"))>0 AND "entradaHash"~'^[0-9a-f]{64}$' AND "estadoHash"~'^[0-9a-f]{64}$' AND jsonb_typeof(evidencia)='object' AND evidencia<>'{}'::jsonb AND jsonb_typeof(entrada)='object' AND entrada<>'{}'::jsonb AND jsonb_typeof(snapshot)='object' AND snapshot<>'{}'::jsonb)
);
CREATE INDEX "PropostaPresencaHistoricaMigracao_linha_status_idx" ON "PropostaPresencaHistoricaMigracao"("linhaId",status);
CREATE INDEX "PropostaPresencaHistoricaMigracao_matricula_criado_idx" ON "PropostaPresencaHistoricaMigracao"("matriculaId","criadoEm");
CREATE INDEX "PropostaPresencaHistoricaMigracao_aula_status_idx" ON "PropostaPresencaHistoricaMigracao"("aulaId",status);

CREATE TABLE "AplicacaoPresencaHistoricaMigracao" (
  id text PRIMARY KEY, "propostaId" text NOT NULL UNIQUE REFERENCES "PropostaPresencaHistoricaMigracao"(id) ON DELETE RESTRICT,
  origem text NOT NULL, "presencaOrigemId" text NOT NULL, resultado "ResultadoAplicacaoPresencaHistoricaMigracao" NOT NULL,
  "registroId" text REFERENCES "RegistroAulaAluno"(id) ON DELETE RESTRICT,
  "registroExistenteId" text REFERENCES "RegistroAulaAluno"(id) ON DELETE RESTRICT,
  "aplicadaPorId" text NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT, snapshot jsonb NOT NULL, "aplicadaEm" timestamptz(6) NOT NULL DEFAULT now(),
  UNIQUE(origem,"presencaOrigemId"),
  CHECK (jsonb_typeof(snapshot)='object' AND snapshot<>'{}'::jsonb AND ((resultado='NOVO_REGISTRO' AND "registroId" IS NOT NULL AND "registroExistenteId" IS NULL) OR (resultado='VINCULO_EXISTENTE' AND "registroId" IS NOT NULL AND "registroExistenteId" IS NOT NULL AND "registroExistenteId"="registroId") OR (resultado='DIVERGENCIA' AND "registroId" IS NULL AND "registroExistenteId" IS NOT NULL)))
);
CREATE INDEX "AplicacaoPresencaHistoricaMigracao_registro_idx" ON "AplicacaoPresencaHistoricaMigracao"("registroId");

CREATE TYPE "ResultadoResolucaoDivergenciaPresencaHistoricaMigracao" AS ENUM ('RECONCILIADA','MANTIDA');
CREATE TABLE "ResolucaoDivergenciaPresencaHistoricaMigracao" (
  id text PRIMARY KEY, "aplicacaoId" text NOT NULL UNIQUE REFERENCES "AplicacaoPresencaHistoricaMigracao"(id) ON DELETE RESTRICT,
  "registroId" text NOT NULL REFERENCES "RegistroAulaAluno"(id) ON DELETE RESTRICT,
  resultado "ResultadoResolucaoDivergenciaPresencaHistoricaMigracao" NOT NULL, evidencia jsonb NOT NULL, "chaveIdempotencia" text NOT NULL UNIQUE,
  "resolvedorId" text NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT, "criadoEm" timestamptz(6) NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(evidencia)='object' AND evidencia<>'{}'::jsonb)
);

CREATE OR REPLACE FUNCTION "m01_presenca_historica_proposta_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE l record; mapa record; aula record;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Proposta de presença M01 é append-only'; END IF;
  IF TG_OP='INSERT' AND (NEW.status<>'PENDENTE' OR NEW."decisorId" IS NOT NULL OR NEW."chaveDecisao" IS NOT NULL OR NEW."decisaoHash" IS NOT NULL OR NEW."motivoDecisao" IS NOT NULL OR NEW."decididoEm" IS NOT NULL OR NEW."aplicadaEm" IS NOT NULL) THEN RAISE EXCEPTION 'Proposta de presença deve iniciar pendente'; END IF;
  IF TG_OP='UPDATE' AND (OLD.id,OLD.origem,OLD."presencaOrigemId",OLD.versao,OLD."linhaId",OLD."mapaMatriculaId",OLD."matriculaId",OLD."aulaId",OLD.participacao,OLD.evidencia,OLD.entrada,OLD.snapshot,OLD."entradaHash",OLD."estadoHash",OLD."chaveIdempotencia",OLD."preparadorId",OLD."criadoEm") IS DISTINCT FROM (NEW.id,NEW.origem,NEW."presencaOrigemId",NEW.versao,NEW."linhaId",NEW."mapaMatriculaId",NEW."matriculaId",NEW."aulaId",NEW.participacao,NEW.evidencia,NEW.entrada,NEW.snapshot,NEW."entradaHash",NEW."estadoHash",NEW."chaveIdempotencia",NEW."preparadorId",NEW."criadoEm") THEN RAISE EXCEPTION 'Proposta de presença M01 é imutável'; END IF;
  IF TG_OP='UPDATE' AND OLD.status IN ('REJEITADA','APLICADA','PENDENCIA_CORRECAO') AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Proposta de presença encerrada é imutável'; END IF;
  IF TG_OP='UPDATE' AND NOT ((OLD.status='PENDENTE' AND NEW.status IN ('APROVADA','REJEITADA')) OR (OLD.status='APROVADA' AND NEW.status IN ('APLICADA','PENDENCIA_CORRECAO'))) THEN RAISE EXCEPTION 'Transição de presença M01 inválida'; END IF;
  IF TG_OP='UPDATE' AND OLD.status='APROVADA' AND (OLD."decisorId",OLD."chaveDecisao",OLD."decisaoHash",OLD."motivoDecisao",OLD."decididoEm") IS DISTINCT FROM (NEW."decisorId",NEW."chaveDecisao",NEW."decisaoHash",NEW."motivoDecisao",NEW."decididoEm") THEN RAISE EXCEPTION 'Decisão de presença M01 é imutável'; END IF;
  IF NEW.status IN ('APROVADA','REJEITADA','APLICADA','PENDENCIA_CORRECAO') AND (NEW."decisorId" IS NULL OR NEW."decisorId"=NEW."preparadorId" OR NULLIF(btrim(NEW."chaveDecisao"),'') IS NULL OR NULLIF(btrim(NEW."decisaoHash"),'') IS NULL OR NULLIF(btrim(NEW."motivoDecisao"),'') IS NULL OR NEW."decididoEm" IS NULL) THEN RAISE EXCEPTION 'Presença M01 exige decisão independente completa'; END IF;
  IF (TG_OP='INSERT' OR NEW.status IN ('APROVADA','APLICADA','PENDENCIA_CORRECAO')) AND NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u.id=NEW."preparadorId" AND u.ativo AND ('SECRETARIA_ACADEMICA'=ANY(u.papeis) OR 'GERENTE_PEDAGOGICO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis))) THEN RAISE EXCEPTION 'Preparador acadêmico sem contexto atual'; END IF;
  IF NEW."decisorId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u.id=NEW."decisorId" AND u.ativo AND ('GERENTE_PEDAGOGICO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis))) THEN RAISE EXCEPTION 'Decisor acadêmico sem contexto atual'; END IF;
  SELECT lf.*,lo.origem AS lote_origem INTO l FROM "LinhaPreparacaoMigracao" lf JOIN "LotePreparacaoMigracao" lo ON lo.id=lf."loteId" WHERE lf.id=NEW."linhaId";
  SELECT * INTO mapa FROM "MapaOrigemMatriculaMigracao" WHERE id=NEW."mapaMatriculaId";
  SELECT d.* INTO aula FROM "AulaDiario" d WHERE d.id=NEW."aulaId";
  IF (TG_OP='INSERT' OR NEW.status IN ('APROVADA','APLICADA','PENDENCIA_CORRECAO')) AND (l."tipoEntrada" IS DISTINCT FROM 'HISTORICO_PRESENCA'::"TipoEntradaPreparacaoMigracao" OR NULLIF(btrim(COALESCE(l."dadosOrigem"->>'presencaOrigem','')),'') IS NULL OR l.lote_origem IS DISTINCT FROM NEW.origem OR mapa.origem IS DISTINCT FROM NEW.origem OR mapa."matriculaOrigemId" IS DISTINCT FROM l."matriculaOrigemId" OR mapa."matriculaId" IS DISTINCT FROM NEW."matriculaId" OR aula.id IS NULL) THEN RAISE EXCEPTION 'Presença M01 exige linha, origem, mapa e aula existentes'; END IF;
  IF (TG_OP='INSERT' OR NEW.status IN ('APROVADA','APLICADA','PENDENCIA_CORRECAO')) AND aula."ocorridaEm" AT TIME ZONE 'UTC' > clock_timestamp() THEN RAISE EXCEPTION 'Aula histórica não pode estar no futuro'; END IF;
  IF (TG_OP='INSERT' OR NEW.status IN ('APROVADA','APLICADA','PENDENCIA_CORRECAO')) AND (SELECT count(*) FROM "Matricula" m JOIN "AlocacaoTurma" al ON al."matriculaId"=m.id JOIN "AulaDiario" d ON d."turmaId"=al."turmaId" WHERE m.id=NEW."matriculaId" AND m."alunoId"=al."alunoId" AND d.id=NEW."aulaId" AND alocacao_cobre_instante(al,d."ocorridaEm" AT TIME ZONE 'UTC') AND situacao_matricula_no_instante(m.id,d."ocorridaEm")='ATIVA') <> 1 THEN RAISE EXCEPTION 'Aula não possui vínculo histórico acadêmico único e ativo'; END IF;
  IF (TG_OP='INSERT' OR NEW.status IN ('APROVADA','APLICADA','PENDENCIA_CORRECAO')) AND (NEW.snapshot->'linha' IS DISTINCT FROM jsonb_build_object('id',l.id,'origem',l.lote_origem,'entradaHash',l."entradaHash",'dadosOrigem',l."dadosOrigem",'matriculaOrigemId',l."matriculaOrigemId") OR NEW.snapshot->'mapa' IS DISTINCT FROM jsonb_build_object('id',mapa.id,'matriculaId',mapa."matriculaId") OR NEW.snapshot->'aula'->>'id' IS DISTINCT FROM aula.id) THEN RAISE EXCEPTION 'Fotografia M01 de presença não corresponde à fonte atual'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "m01_presenca_historica_proposta_guard" BEFORE INSERT OR UPDATE OR DELETE ON "PropostaPresencaHistoricaMigracao" FOR EACH ROW EXECUTE FUNCTION "m01_presenca_historica_proposta_guard"();

CREATE OR REPLACE FUNCTION "m01_presenca_historica_aplicacao_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p record; r record; e record;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN RAISE EXCEPTION 'Aplicação de presença M01 é append-only'; END IF;
  SELECT * INTO p FROM "PropostaPresencaHistoricaMigracao" WHERE id=NEW."propostaId";
  SELECT * INTO r FROM "RegistroAulaAluno" WHERE id=COALESCE(NEW."registroId",NEW."registroExistenteId");
  IF p.status IS DISTINCT FROM 'APROVADA' OR p."decisorId" IS DISTINCT FROM NEW."aplicadaPorId" OR p.origem IS DISTINCT FROM NEW.origem OR p."presencaOrigemId" IS DISTINCT FROM NEW."presencaOrigemId" OR r."aulaId" IS DISTINCT FROM p."aulaId" OR r."matriculaId" IS DISTINCT FROM p."matriculaId" THEN RAISE EXCEPTION 'Aplicação M01 não corresponde à proposta aprovada'; END IF;
  IF NEW.resultado IN ('NOVO_REGISTRO','VINCULO_EXISTENTE') AND (r.participacao IS DISTINCT FROM p.participacao OR r.presente IS DISTINCT FROM (p.participacao='PRESENTE'::"ParticipacaoAula")) THEN RAISE EXCEPTION 'Registro existente não corresponde à presença aprovada'; END IF;
  IF NEW.resultado='DIVERGENCIA' AND (r.participacao IS NOT DISTINCT FROM p.participacao AND r.presente IS NOT DISTINCT FROM (p.participacao='PRESENTE'::"ParticipacaoAula")) THEN RAISE EXCEPTION 'Divergência M01 precisa de registro realmente distinto'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "m01_presenca_historica_aplicacao_guard" BEFORE INSERT OR UPDATE OR DELETE ON "AplicacaoPresencaHistoricaMigracao" FOR EACH ROW EXECUTE FUNCTION "m01_presenca_historica_aplicacao_guard"();

CREATE OR REPLACE FUNCTION "m01_presenca_historica_resolucao_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a record; p record; r record;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN RAISE EXCEPTION 'Resolução de divergência M01 é append-only'; END IF;
  SELECT * INTO a FROM "AplicacaoPresencaHistoricaMigracao" WHERE id=NEW."aplicacaoId";
  SELECT * INTO p FROM "PropostaPresencaHistoricaMigracao" WHERE id=a."propostaId";
  SELECT * INTO r FROM "RegistroAulaAluno" WHERE id=NEW."registroId";
  IF a.resultado IS DISTINCT FROM 'DIVERGENCIA' OR p.status IS DISTINCT FROM 'PENDENCIA_CORRECAO' OR a."registroExistenteId" IS DISTINCT FROM NEW."registroId" OR r."aulaId" IS DISTINCT FROM p."aulaId" OR r."matriculaId" IS DISTINCT FROM p."matriculaId" OR NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u.id=NEW."resolvedorId" AND u.ativo AND ('GERENTE_PEDAGOGICO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis))) THEN RAISE EXCEPTION 'Resolução M01 não corresponde à divergência acadêmica'; END IF;
  IF NEW.resultado='RECONCILIADA' AND (r.participacao IS DISTINCT FROM p.participacao OR r.presente IS DISTINCT FROM (p.participacao='PRESENTE'::"ParticipacaoAula")) THEN RAISE EXCEPTION 'Correção Q23 ainda não coincide com a presença histórica'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "m01_presenca_historica_resolucao_guard" BEFORE INSERT OR UPDATE OR DELETE ON "ResolucaoDivergenciaPresencaHistoricaMigracao" FOR EACH ROW EXECUTE FUNCTION "m01_presenca_historica_resolucao_guard"();

CREATE OR REPLACE FUNCTION "m01_presenca_historica_commit_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE proposta text;
BEGIN
  IF TG_RELID='"AplicacaoPresencaHistoricaMigracao"'::regclass THEN proposta:=NEW."propostaId"; ELSE proposta:=NEW.id; END IF;
  IF EXISTS (SELECT 1 FROM "PropostaPresencaHistoricaMigracao" p WHERE p.id=proposta AND (p.status='APLICADA' AND (p."aplicadaEm" IS NULL OR NOT EXISTS (SELECT 1 FROM "AplicacaoPresencaHistoricaMigracao" a WHERE a."propostaId"=p.id AND a.resultado IN ('NOVO_REGISTRO','VINCULO_EXISTENTE'))) OR p.status='PENDENCIA_CORRECAO' AND (p."aplicadaEm" IS NULL OR NOT EXISTS (SELECT 1 FROM "AplicacaoPresencaHistoricaMigracao" a WHERE a."propostaId"=p.id AND a.resultado='DIVERGENCIA')) OR p.status='APROVADA')) THEN RAISE EXCEPTION 'Decisão de presença M01 exige aplicação final coerente no mesmo commit'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "m01_presenca_historica_proposta_commit_guard" AFTER UPDATE ON "PropostaPresencaHistoricaMigracao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "m01_presenca_historica_commit_guard"();
CREATE CONSTRAINT TRIGGER "m01_presenca_historica_aplicacao_commit_guard" AFTER INSERT ON "AplicacaoPresencaHistoricaMigracao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "m01_presenca_historica_commit_guard"();
