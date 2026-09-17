-- M01/195. Revisar antes de aplicar. Entrada histórica cria somente obrigação
-- pendente e pagador; nunca cria Recebimento, quitação, crédito ou transporte.
CREATE TYPE "StatusPropostaEntradaFinanceiraHistoricaMigracao" AS ENUM ('PENDENTE','APROVADA','REJEITADA','APLICADA');

CREATE TABLE "PropostaEntradaFinanceiraHistoricaMigracao" (
  id text PRIMARY KEY, origem text NOT NULL, "financeiroOrigemId" text NOT NULL, versao integer NOT NULL CHECK (versao > 0),
  "linhaId" text NOT NULL REFERENCES "LinhaPreparacaoMigracao"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "mapaMatriculaId" text NOT NULL REFERENCES "MapaOrigemMatriculaMigracao"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "matriculaId" text NOT NULL REFERENCES "Matricula"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "preparadorId" text NOT NULL REFERENCES "Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "decisorId" text REFERENCES "Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "tipoCobranca" "TipoCobranca" NOT NULL, valor numeric(12,2) NOT NULL CHECK (valor > 0), moeda text NOT NULL CHECK (moeda ~ '^[A-Z]{3}$'),
  vencimento date NOT NULL, competencia text CHECK (competencia IS NULL OR competencia ~ '^[0-9]{4}-[0-9]{2}$'),
  "dadosPagador" jsonb NOT NULL, evidencia jsonb NOT NULL, complemento jsonb, entrada jsonb NOT NULL, snapshot jsonb NOT NULL,
  "entradaHash" text NOT NULL, "estadoHash" text NOT NULL, "chaveIdempotencia" text NOT NULL, "chaveDecisao" text, "decisaoHash" text,
  status "StatusPropostaEntradaFinanceiraHistoricaMigracao" NOT NULL DEFAULT 'PENDENTE', "motivoDecisao" text,
  "decididoEm" timestamptz(6), "aplicadaEm" timestamptz(6), "criadoEm" timestamptz(6) NOT NULL DEFAULT now(),
  UNIQUE (origem,"financeiroOrigemId",versao), UNIQUE ("preparadorId","chaveIdempotencia"), UNIQUE ("decisorId","chaveDecisao")
);
CREATE INDEX "PropostaEntradaFinanceiraHistorica_linha_status_idx" ON "PropostaEntradaFinanceiraHistoricaMigracao" ("linhaId",status);
CREATE INDEX "PropostaEntradaFinanceiraHistorica_matricula_criado_idx" ON "PropostaEntradaFinanceiraHistoricaMigracao" ("matriculaId","criadoEm");

CREATE TABLE "AplicacaoEntradaFinanceiraHistoricaMigracao" (
 id text PRIMARY KEY, "propostaId" text NOT NULL UNIQUE REFERENCES "PropostaEntradaFinanceiraHistoricaMigracao"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
 origem text NOT NULL, "financeiroOrigemId" text NOT NULL, "pagadorId" text NOT NULL UNIQUE REFERENCES "PagadorPreparacaoMatricula"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
 "cobrancaId" text NOT NULL UNIQUE REFERENCES "Cobranca"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
 "aplicadaPorId" text NOT NULL REFERENCES "Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT, snapshot jsonb NOT NULL, "aplicadaEm" timestamptz(6) NOT NULL DEFAULT now(),
 UNIQUE (origem,"financeiroOrigemId")
);

CREATE OR REPLACE FUNCTION "m01_entrada_financeira_proposta_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE l record; m record;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Proposta de entrada financeira M01 é append-only'; END IF;
 IF TG_OP='INSERT' AND (NEW.status<>'PENDENTE' OR NEW."decisorId" IS NOT NULL OR NEW."chaveDecisao" IS NOT NULL OR NEW."decisaoHash" IS NOT NULL OR NEW."motivoDecisao" IS NOT NULL OR NEW."decididoEm" IS NOT NULL OR NEW."aplicadaEm" IS NOT NULL) THEN RAISE EXCEPTION 'Proposta M01 deve iniciar pendente sem decisão ou aplicação'; END IF;
 IF TG_OP='UPDATE' AND (OLD.id,OLD.origem,OLD."financeiroOrigemId",OLD.versao,OLD."linhaId",OLD."mapaMatriculaId",OLD."matriculaId",OLD."preparadorId",OLD."tipoCobranca",OLD.valor,OLD.moeda,OLD.vencimento,OLD.competencia,OLD."dadosPagador",OLD.evidencia,OLD.complemento,OLD.entrada,OLD.snapshot,OLD."entradaHash",OLD."estadoHash",OLD."chaveIdempotencia",OLD."criadoEm") IS DISTINCT FROM (NEW.id,NEW.origem,NEW."financeiroOrigemId",NEW.versao,NEW."linhaId",NEW."mapaMatriculaId",NEW."matriculaId",NEW."preparadorId",NEW."tipoCobranca",NEW.valor,NEW.moeda,NEW.vencimento,NEW.competencia,NEW."dadosPagador",NEW.evidencia,NEW.complemento,NEW.entrada,NEW.snapshot,NEW."entradaHash",NEW."estadoHash",NEW."chaveIdempotencia",NEW."criadoEm") THEN RAISE EXCEPTION 'Proposta de entrada financeira M01 é imutável'; END IF;
 IF TG_OP='UPDATE' AND OLD.status IN ('REJEITADA','APLICADA') AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Proposta M01 encerrada é imutável'; END IF;
 IF TG_OP='UPDATE' AND NOT ((OLD.status='PENDENTE' AND NEW.status IN ('APROVADA','REJEITADA')) OR (OLD.status='APROVADA' AND NEW.status='APLICADA')) THEN RAISE EXCEPTION 'Transição de proposta M01 inválida'; END IF;
 IF TG_OP='UPDATE' AND OLD.status='APROVADA' AND (OLD."decisorId",OLD."chaveDecisao",OLD."decisaoHash",OLD."motivoDecisao",OLD."decididoEm") IS DISTINCT FROM (NEW."decisorId",NEW."chaveDecisao",NEW."decisaoHash",NEW."motivoDecisao",NEW."decididoEm") THEN RAISE EXCEPTION 'Decisão M01 aprovada é imutável'; END IF;
 IF NEW.status IN ('APROVADA','REJEITADA','APLICADA') AND (NEW."decisorId" IS NULL OR NEW."decisorId"=NEW."preparadorId" OR NULLIF(btrim(NEW."chaveDecisao"),'') IS NULL OR NULLIF(btrim(NEW."decisaoHash"),'') IS NULL OR NULLIF(btrim(NEW."motivoDecisao"),'') IS NULL OR NEW."decididoEm" IS NULL) THEN RAISE EXCEPTION 'M01 exige decisão independente, motivo, chave, hash e data'; END IF;
 IF NEW.status='APLICADA' AND (NEW."decisorId" IS NULL OR NEW."aplicadaEm" IS NULL) THEN RAISE EXCEPTION 'Aplicação M01 exige decisão anterior'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u.id=NEW."preparadorId" AND u.ativo AND ('FINANCEIRO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis))) OR (NEW."decisorId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u.id=NEW."decisorId" AND u.ativo AND ('FINANCEIRO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis)))) THEN RAISE EXCEPTION 'Autor financeiro sem contexto atual'; END IF;
 SELECT l.*,lo.origem AS lote_origem INTO l FROM "LinhaPreparacaoMigracao" l JOIN "LotePreparacaoMigracao" lo ON lo.id=l."loteId" WHERE l.id=NEW."linhaId";
 SELECT * INTO m FROM "MapaOrigemMatriculaMigracao" WHERE id=NEW."mapaMatriculaId";
 IF l."tipoEntrada" IS DISTINCT FROM 'FINANCEIRO_HISTORICO'::"TipoEntradaPreparacaoMigracao" OR l."financeiroOrigemId" IS NULL OR l.lote_origem IS DISTINCT FROM NEW.origem OR l."financeiroOrigemId" IS DISTINCT FROM NEW."financeiroOrigemId" OR m.origem IS DISTINCT FROM NEW.origem OR m."matriculaOrigemId" IS DISTINCT FROM l."matriculaOrigemId" OR m."matriculaId" IS DISTINCT FROM NEW."matriculaId" THEN RAISE EXCEPTION 'M01 exige linha, origem e mapa de matrícula correspondentes'; END IF;
 IF COALESCE(jsonb_typeof(NEW.evidencia),'') IS DISTINCT FROM 'object' OR COALESCE(NEW.evidencia,'{}'::jsonb)='{}'::jsonb OR COALESCE(jsonb_typeof(NEW."dadosPagador"),'') IS DISTINCT FROM 'object' OR NOT (COALESCE(NEW."dadosPagador"->>'tipo','') = ANY(ARRAY['ALUNO','RESPONSAVEL','EMPRESA'])) OR COALESCE(jsonb_typeof(NEW."dadosPagador"->'dados'),'') IS DISTINCT FROM 'object' OR NULLIF(btrim(NEW."dadosPagador"->'dados'->>'nome'),'') IS NULL OR NULLIF(btrim(NEW."dadosPagador"->'dados'->>'paisId'),'') IS NULL THEN RAISE EXCEPTION 'Pagador e evidência estruturados são obrigatórios'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "m01_entrada_financeira_proposta_guard" BEFORE INSERT OR UPDATE OR DELETE ON "PropostaEntradaFinanceiraHistoricaMigracao" FOR EACH ROW EXECUTE FUNCTION "m01_entrada_financeira_proposta_guard"();

CREATE OR REPLACE FUNCTION "m01_entrada_financeira_aplicacao_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p record; c record; pg record;
BEGIN
 IF TG_OP IN ('UPDATE','DELETE') THEN RAISE EXCEPTION 'Aplicação de entrada financeira M01 é append-only'; END IF;
 SELECT * INTO p FROM "PropostaEntradaFinanceiraHistoricaMigracao" WHERE id=NEW."propostaId";
 SELECT * INTO c FROM "Cobranca" WHERE id=NEW."cobrancaId";
 SELECT * INTO pg FROM "PagadorPreparacaoMatricula" WHERE id=NEW."pagadorId";
 IF p.status IS DISTINCT FROM 'APROVADA' OR p."decisorId" IS DISTINCT FROM NEW."aplicadaPorId" OR p.origem IS DISTINCT FROM NEW.origem OR p."financeiroOrigemId" IS DISTINCT FROM NEW."financeiroOrigemId" OR c."matriculaId" IS DISTINCT FROM p."matriculaId" OR pg."matriculaId" IS DISTINCT FROM p."matriculaId" OR c.status IS DISTINCT FROM 'PENDENTE' OR c."valorRecebido" IS NOT NULL OR c.saldo IS DISTINCT FROM c."valorNegociado" OR c."valorOriginal" IS DISTINCT FROM p.valor OR c."valorNegociado" IS DISTINCT FROM p.valor OR c.saldo IS DISTINCT FROM p.valor OR c.moeda IS DISTINCT FROM p.moeda OR c.tipo IS DISTINCT FROM p."tipoCobranca" OR c.vencimento::date IS DISTINCT FROM p.vencimento OR c.competencia IS DISTINCT FROM p.competencia OR pg.tipo IS DISTINCT FROM p."dadosPagador"->>'tipo' OR pg.dados IS DISTINCT FROM p."dadosPagador"->'dados' THEN RAISE EXCEPTION 'Aplicação M01 deve materializar exatamente o pagador e obrigação pendente aprovados'; END IF;
 IF EXISTS (SELECT 1 FROM "Recebimento" r WHERE r."cobrancaId"=c.id) THEN RAISE EXCEPTION 'M01 não admite recebimento histórico fabricado'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "m01_entrada_financeira_aplicacao_guard" BEFORE INSERT OR UPDATE OR DELETE ON "AplicacaoEntradaFinanceiraHistoricaMigracao" FOR EACH ROW EXECUTE FUNCTION "m01_entrada_financeira_aplicacao_guard"();

CREATE OR REPLACE FUNCTION "m01_entrada_financeira_commit_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE proposta text;
BEGIN
 proposta:=CASE WHEN TG_TABLE_NAME='AplicacaoEntradaFinanceiraHistoricaMigracao' THEN NEW."propostaId" ELSE NEW.id END;
 IF EXISTS (SELECT 1 FROM "PropostaEntradaFinanceiraHistoricaMigracao" p WHERE p.id=proposta AND p.status='APROVADA') AND NOT EXISTS (SELECT 1 FROM "AplicacaoEntradaFinanceiraHistoricaMigracao" a WHERE a."propostaId"=proposta) THEN RAISE EXCEPTION 'Aprovação M01 exige aplicação correspondente no mesmo commit'; END IF;
 IF EXISTS (SELECT 1 FROM "PropostaEntradaFinanceiraHistoricaMigracao" p WHERE p.id=proposta AND p.status='APLICADA' AND NOT EXISTS (SELECT 1 FROM "AplicacaoEntradaFinanceiraHistoricaMigracao" a WHERE a."propostaId"=p.id)) THEN RAISE EXCEPTION 'Aplicação M01 sem registro correspondente'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "m01_entrada_financeira_proposta_commit_guard" AFTER UPDATE ON "PropostaEntradaFinanceiraHistoricaMigracao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "m01_entrada_financeira_commit_guard"();
CREATE CONSTRAINT TRIGGER "m01_entrada_financeira_aplicacao_commit_guard" AFTER INSERT ON "AplicacaoEntradaFinanceiraHistoricaMigracao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "m01_entrada_financeira_commit_guard"();
