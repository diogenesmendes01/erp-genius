-- M01/192. Base: migrations 185–191 já aplicadas. Não altera cobranças nem recebimentos existentes.
CREATE TYPE "ModalidadeConciliacaoFinanceiraMigracao" AS ENUM ('PENDENCIA','VINCULAR_RECEBIMENTO','BAIXAR');
CREATE TYPE "StatusPropostaConciliacaoFinanceiraMigracao" AS ENUM ('PENDENTE','APROVADA','REJEITADA','APLICADA');

CREATE TABLE "PropostaConciliacaoFinanceiraMigracao" (
  id text PRIMARY KEY, origem text NOT NULL, "financeiroOrigemId" text NOT NULL, versao integer NOT NULL CHECK (versao > 0),
  "linhaId" text NOT NULL REFERENCES "LinhaPreparacaoMigracao"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "matriculaId" text NOT NULL REFERENCES "Matricula"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "cobrancaId" text NOT NULL REFERENCES "Cobranca"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "pagadorId" text NOT NULL REFERENCES "PagadorPreparacaoMatricula"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "preparadorId" text NOT NULL REFERENCES "Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "decisorId" text REFERENCES "Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  modalidade "ModalidadeConciliacaoFinanceiraMigracao" NOT NULL,
  valor numeric(12,2), moeda text, "dataPagamento" timestamptz(6), forma "FormaPagamento",
  "recebimentoExistenteId" text REFERENCES "Recebimento"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  evidencia jsonb NOT NULL, complemento jsonb, entrada jsonb NOT NULL, snapshot jsonb NOT NULL,
  "entradaHash" text NOT NULL, "estadoHash" text NOT NULL, "chaveIdempotencia" text NOT NULL, "chaveDecisao" text,
  status "StatusPropostaConciliacaoFinanceiraMigracao" NOT NULL DEFAULT 'PENDENTE', "motivoDecisao" text,
  "decididoEm" timestamptz(6), "aplicadaEm" timestamptz(6), "criadoEm" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "PropostaConciliacaoFinanceira_origem_financeiro_versao_key" UNIQUE (origem,"financeiroOrigemId",versao),
  CONSTRAINT "PropostaConciliacaoFinanceiraMigracao_preparador_chave_key" UNIQUE ("preparadorId","chaveIdempotencia"),
  CONSTRAINT "PropostaConciliacaoFinanceiraMigracao_decisor_chave_decisao_key" UNIQUE ("decisorId","chaveDecisao"),
  CONSTRAINT "PropostaConciliacaoFinanceiraMigracao_forma_valor_check" CHECK (
    (modalidade='PENDENCIA' AND valor IS NULL AND moeda IS NULL AND "dataPagamento" IS NULL AND forma IS NULL AND "recebimentoExistenteId" IS NULL) OR
    (modalidade='VINCULAR_RECEBIMENTO' AND valor IS NOT NULL AND moeda IS NOT NULL AND "dataPagamento" IS NOT NULL AND forma IS NOT NULL AND "recebimentoExistenteId" IS NOT NULL) OR
    (modalidade='BAIXAR' AND valor IS NOT NULL AND valor > 0 AND moeda ~ '^[A-Z]{3}$' AND "dataPagamento" IS NOT NULL AND forma IS NOT NULL AND "recebimentoExistenteId" IS NULL)
  )
);
CREATE INDEX "PropostaConciliacaoFinanceiraMigracao_linha_status_idx" ON "PropostaConciliacaoFinanceiraMigracao" ("linhaId",status);
CREATE INDEX "PropostaConciliacaoFinanceiraMigracao_cobranca_status_idx" ON "PropostaConciliacaoFinanceiraMigracao" ("cobrancaId",status);
CREATE INDEX "PropostaConciliacaoFinanceiraMigracao_matricula_criado_idx" ON "PropostaConciliacaoFinanceiraMigracao" ("matriculaId","criadoEm");

CREATE TABLE "ConciliacaoFinanceiraMigracao" (
  id text PRIMARY KEY, origem text NOT NULL, "financeiroOrigemId" text NOT NULL, "propostaId" text NOT NULL UNIQUE REFERENCES "PropostaConciliacaoFinanceiraMigracao"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "recebimentoId" text UNIQUE REFERENCES "Recebimento"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  "aplicadaPorId" text NOT NULL REFERENCES "Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  snapshot jsonb NOT NULL, "aplicadaEm" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "ConciliacaoFinanceiraMigracao_origem_financeiro_key" UNIQUE (origem,"financeiroOrigemId")
);

CREATE OR REPLACE FUNCTION "conferir_proposta_conciliacao_financeira_migracao"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE linha_tipo "TipoEntradaPreparacaoMigracao"; linha_financeiro text; lote_origem text; cobranca_matricula text; pagador_matricula text; receb record;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Proposta financeira M01 é append-only'; END IF;
  IF TG_OP='INSERT' AND NEW.status IS DISTINCT FROM 'PENDENTE' THEN RAISE EXCEPTION 'Proposta financeira inicia pendente'; END IF;
  IF TG_OP='UPDATE' AND (OLD.id,OLD.origem,OLD."financeiroOrigemId",OLD.versao,OLD."linhaId",OLD."matriculaId",OLD."cobrancaId",OLD."pagadorId",OLD.modalidade,OLD.valor,OLD.moeda,OLD."dataPagamento",OLD.forma,OLD."recebimentoExistenteId",OLD.evidencia,OLD.complemento,OLD.entrada,OLD.snapshot,OLD."entradaHash",OLD."estadoHash",OLD."chaveIdempotencia",OLD."preparadorId",OLD."criadoEm") IS DISTINCT FROM (NEW.id,NEW.origem,NEW."financeiroOrigemId",NEW.versao,NEW."linhaId",NEW."matriculaId",NEW."cobrancaId",NEW."pagadorId",NEW.modalidade,NEW.valor,NEW.moeda,NEW."dataPagamento",NEW.forma,NEW."recebimentoExistenteId",NEW.evidencia,NEW.complemento,NEW.entrada,NEW.snapshot,NEW."entradaHash",NEW."estadoHash",NEW."chaveIdempotencia",NEW."preparadorId",NEW."criadoEm") THEN RAISE EXCEPTION 'Proposta financeira M01 é imutável'; END IF;
  IF TG_OP='UPDATE' AND OLD.status IN ('REJEITADA','APLICADA') AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Proposta financeira M01 encerrada é imutável'; END IF;
  IF TG_OP='UPDATE' AND OLD.status='APROVADA' AND (OLD."decisorId",OLD."motivoDecisao",OLD."chaveDecisao",OLD."decididoEm") IS DISTINCT FROM (NEW."decisorId",NEW."motivoDecisao",NEW."chaveDecisao",NEW."decididoEm") THEN RAISE EXCEPTION 'Decisão aprovada é imutável'; END IF;
  IF TG_OP='UPDATE' AND NOT ((OLD.status='PENDENTE' AND NEW.status IN ('APROVADA','REJEITADA')) OR (OLD.status='APROVADA' AND NEW.status='APLICADA')) THEN RAISE EXCEPTION 'Transição financeira M01 inválida'; END IF;
  IF NEW.status IN ('APROVADA','REJEITADA') AND (NEW."decisorId" IS NULL OR NEW."decisorId"=NEW."preparadorId" OR NEW."motivoDecisao" IS NULL OR btrim(NEW."motivoDecisao")='' OR NEW."decididoEm" IS NULL OR NEW."chaveDecisao" IS NULL OR btrim(NEW."chaveDecisao")='') THEN RAISE EXCEPTION 'Decisão exige decisor independente, motivo, chave e data'; END IF;
  IF NEW.status='APLICADA' AND (NEW."decisorId" IS NULL OR NEW."aplicadaEm" IS NULL) THEN RAISE EXCEPTION 'Aplicação exige decisão e data'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u.id=NEW."preparadorId" AND u.ativo AND ('FINANCEIRO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis))) THEN RAISE EXCEPTION 'Preparador financeiro inativo ou sem papel'; END IF;
  IF NEW."decisorId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u.id=NEW."decisorId" AND u.ativo AND ('FINANCEIRO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis))) THEN RAISE EXCEPTION 'Decisor financeiro inativo ou sem papel'; END IF;
  SELECT l."tipoEntrada",l."financeiroOrigemId",lo.origem INTO linha_tipo,linha_financeiro,lote_origem FROM "LinhaPreparacaoMigracao" l JOIN "LotePreparacaoMigracao" lo ON lo.id=l."loteId" WHERE l.id=NEW."linhaId";
  IF linha_tipo IS DISTINCT FROM 'FINANCEIRO_HISTORICO'::"TipoEntradaPreparacaoMigracao" OR linha_financeiro IS NULL OR lote_origem IS DISTINCT FROM NEW.origem OR linha_financeiro IS DISTINCT FROM NEW."financeiroOrigemId" THEN RAISE EXCEPTION 'Proposta exige linha financeira identificada da mesma origem'; END IF;
  SELECT "matriculaId" INTO cobranca_matricula FROM "Cobranca" WHERE id=NEW."cobrancaId";
  SELECT "matriculaId" INTO pagador_matricula FROM "PagadorPreparacaoMatricula" WHERE id=NEW."pagadorId";
  IF cobranca_matricula IS DISTINCT FROM NEW."matriculaId" OR pagador_matricula IS DISTINCT FROM NEW."matriculaId" THEN RAISE EXCEPTION 'Cobrança e pagador devem pertencer ao contrato explícito'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "MapaOrigemMatriculaMigracao" m WHERE m.origem=NEW.origem AND m."matriculaOrigemId"=(SELECT "matriculaOrigemId" FROM "LinhaPreparacaoMigracao" WHERE id=NEW."linhaId") AND m."matriculaId"=NEW."matriculaId") THEN RAISE EXCEPTION 'Contrato não possui vínculo M01 correspondente à origem'; END IF;
  IF NEW.modalidade='VINCULAR_RECEBIMENTO' THEN
    SELECT r.* INTO receb FROM "Recebimento" r WHERE r.id=NEW."recebimentoExistenteId";
    IF receb."cobrancaId" IS DISTINCT FROM NEW."cobrancaId"
       OR receb.valor IS DISTINCT FROM NEW.valor
       OR receb.moeda IS DISTINCT FROM NEW.moeda
       OR (receb."dataPagamento" AT TIME ZONE 'UTC') IS DISTINCT FROM NEW."dataPagamento"
       OR receb.forma IS DISTINCT FROM NEW.forma THEN
      RAISE EXCEPTION 'Recebimento existente não corresponde à conciliação fotografada';
    END IF;
  END IF;

  -- A aprovação é deliberadamente anterior a receberTx: esta foto é validada
  -- quando a cobrança ainda está pré-baixa e não pode ser aceita se qualquer
  -- objeto que formou o hash mudou.
  IF TG_OP='UPDATE' AND OLD.status='PENDENTE' AND NEW.status='APROVADA' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM "LinhaPreparacaoMigracao" l
      JOIN "LotePreparacaoMigracao" lo ON lo.id=l."loteId"
      WHERE l.id=NEW."linhaId"
        AND NEW.snapshot->'linha' IS NOT DISTINCT FROM jsonb_build_object(
          'id',l.id,'origem',lo.origem,'financeiroOrigemId',l."financeiroOrigemId",
          'matriculaOrigemId',l."matriculaOrigemId",'entradaHash',l."entradaHash",
          'dadosOrigem',l."dadosOrigem",'loteId',l."loteId")
    ) THEN
      RAISE EXCEPTION 'Fotografia da linha financeira mudou; prepare nova conciliação';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM "MapaOrigemMatriculaMigracao" m
      WHERE m.origem=NEW.origem AND m."matriculaId"=NEW."matriculaId"
        AND NEW.snapshot->'mapa' IS NOT DISTINCT FROM jsonb_build_object(
          'origem',m.origem,'matriculaOrigemId',m."matriculaOrigemId",
          'matriculaId',m."matriculaId",'linhaId',m."linhaId",'entradaHash',m."entradaHash")
    ) THEN
      RAISE EXCEPTION 'Fotografia do mapa M01 mudou; prepare nova conciliação';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM "Cobranca" c
      WHERE c.id=NEW."cobrancaId"
        AND NEW.snapshot->'cobranca'->>'id'=c.id
        AND NEW.snapshot->'cobranca'->>'matriculaId'=c."matriculaId"
        AND NEW.snapshot->'cobranca'->>'status'=c.status::text
        AND NEW.snapshot->'cobranca'->>'moeda'=c.moeda
        AND NEW.snapshot->'cobranca'->>'versao'=c.versao::text
        AND (NEW.snapshot->'cobranca'->>'valorOriginal')::numeric=c."valorOriginal"
        AND (NEW.snapshot->'cobranca'->>'valorNegociado')::numeric=c."valorNegociado"
        AND (NEW.snapshot->'cobranca'->>'valorRecebido')::numeric IS NOT DISTINCT FROM c."valorRecebido"
        AND (NEW.snapshot->'cobranca'->>'saldo')::numeric IS NOT DISTINCT FROM c.saldo
        AND (NEW.snapshot->'cobranca'->>'valorLiquidadoCredito')::numeric IS NOT DISTINCT FROM c."valorLiquidadoCredito"
        AND (NEW.snapshot->'cobranca'->>'pagoEm') IS NOT DISTINCT FROM CASE WHEN c."pagoEm" IS NULL THEN NULL ELSE to_char(c."pagoEm",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END
        AND (NEW.snapshot->'cobranca'->>'formaPagamento') IS NOT DISTINCT FROM c."formaPagamento"::text
        AND (NEW.snapshot->'cobranca'->>'comprovanteUrl') IS NOT DISTINCT FROM c."comprovanteUrl"
        AND (NEW.snapshot->'cobranca'->>'comprovanteNome') IS NOT DISTINCT FROM c."comprovanteNome"
        AND (NEW.snapshot->'cobranca'->>'comentario') IS NOT DISTINCT FROM c.comentario
        AND (NEW.snapshot->'cobranca'->>'vencimento')=to_char(c.vencimento,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ) THEN
      RAISE EXCEPTION 'Fotografia da cobrança mudou; prepare nova conciliação';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM "PagadorPreparacaoMatricula" p
      WHERE p.id=NEW."pagadorId"
        AND NEW.snapshot->'pagador' IS NOT DISTINCT FROM jsonb_build_object(
          'id',p.id,'matriculaId',p."matriculaId",'versao',p.versao,'tipo',p.tipo,'dados',p.dados)
    ) THEN
      RAISE EXCEPTION 'Fotografia do pagador mudou; prepare nova conciliação';
    END IF;

    IF NEW.modalidade='VINCULAR_RECEBIMENTO' AND NOT EXISTS (
      SELECT 1
      FROM "Recebimento" r
      WHERE r.id=NEW."recebimentoExistenteId"
        AND NEW.snapshot->'recebimento'->>'id'=r.id
        AND NEW.snapshot->'recebimento'->>'cobrancaId'=r."cobrancaId"
        AND (NEW.snapshot->'recebimento'->>'valor')::numeric=r.valor
        AND NEW.snapshot->'recebimento'->>'moeda'=r.moeda
        AND NEW.snapshot->'recebimento'->>'forma'=r.forma::text
        AND (NEW.snapshot->'recebimento'->>'dataPagamento')=to_char(r."dataPagamento",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        AND (NEW.snapshot->'recebimento'->>'hashDados') IS NOT DISTINCT FROM r."hashDados"
        AND (NEW.snapshot->'recebimento'->>'chaveIdempotencia')=r."chaveIdempotencia"
        AND (NEW.snapshot->'recebimento'->>'autorId')=r."autorId"
    ) THEN
      RAISE EXCEPTION 'Fotografia do recebimento ERP mudou; prepare nova conciliação';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "proposta_conciliacao_financeira_migracao_guard" BEFORE INSERT OR UPDATE ON "PropostaConciliacaoFinanceiraMigracao" FOR EACH ROW EXECUTE FUNCTION "conferir_proposta_conciliacao_financeira_migracao"();
CREATE TRIGGER "proposta_conciliacao_financeira_migracao_no_delete" BEFORE DELETE ON "PropostaConciliacaoFinanceiraMigracao" FOR EACH ROW EXECUTE FUNCTION "conferir_proposta_conciliacao_financeira_migracao"();

CREATE OR REPLACE FUNCTION "conferir_aplicacao_conciliacao_financeira_migracao"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p record;
BEGIN
 IF TG_OP IN ('UPDATE','DELETE') THEN RAISE EXCEPTION 'Aplicação financeira M01 é append-only'; END IF;
 SELECT * INTO p FROM "PropostaConciliacaoFinanceiraMigracao" WHERE id=NEW."propostaId";
 IF NEW.origem IS DISTINCT FROM p.origem OR NEW."financeiroOrigemId" IS DISTINCT FROM p."financeiroOrigemId" THEN RAISE EXCEPTION 'Aplicação deve preservar a identidade financeira da origem'; END IF;
 IF p.status IS DISTINCT FROM 'APROVADA' OR p."decisorId" IS NULL OR p."decisorId"=p."preparadorId" OR p."decisorId" IS DISTINCT FROM NEW."aplicadaPorId" THEN RAISE EXCEPTION 'Aplicação exige proposta aprovada por decisor independente'; END IF;
 IF p.modalidade='PENDENCIA' AND NEW."recebimentoId" IS NOT NULL THEN RAISE EXCEPTION 'Pendência financeira não recebe pagamento'; END IF;
 IF p.modalidade IN ('VINCULAR_RECEBIMENTO','BAIXAR') AND NEW."recebimentoId" IS NULL THEN RAISE EXCEPTION 'Conciliação de pagamento exige recebimento'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u.id=NEW."aplicadaPorId" AND u.ativo AND ('FINANCEIRO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis))) THEN RAISE EXCEPTION 'Aplicador financeiro inativo ou sem papel'; END IF;
 IF p.modalidade='VINCULAR_RECEBIMENTO' AND NEW."recebimentoId" IS DISTINCT FROM p."recebimentoExistenteId" THEN RAISE EXCEPTION 'Aplicação deve usar recebimento conferido'; END IF;
 IF p.modalidade='BAIXAR' AND NOT EXISTS (SELECT 1 FROM "Recebimento" r WHERE r.id=NEW."recebimentoId" AND r."cobrancaId"=p."cobrancaId" AND r.valor=p.valor AND r.moeda=p.moeda AND (r."dataPagamento" AT TIME ZONE 'UTC')=p."dataPagamento" AND r.forma=p.forma AND r."chaveIdempotencia"=('m01-financeiro:'||p.id) AND r."autorId"=p."decisorId" AND r."autorId"=NEW."aplicadaPorId") THEN RAISE EXCEPTION 'Recebimento baixado não corresponde materialmente à proposta'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "aplicacao_conciliacao_financeira_migracao_guard" BEFORE INSERT OR UPDATE OR DELETE ON "ConciliacaoFinanceiraMigracao" FOR EACH ROW EXECUTE FUNCTION "conferir_aplicacao_conciliacao_financeira_migracao"();

-- A aprovação, o recebimento e a aplicação precisam ocorrer na mesma transação.
-- Ambos os gatilhos são deferred para permitir a ordem: aprovar, baixar/vincular,
-- inserir a aplicação e marcar a proposta APLICADA.
CREATE OR REPLACE FUNCTION "conferir_commit_conciliacao_financeira_migracao"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE proposta_id text; estado "StatusPropostaConciliacaoFinanceiraMigracao"; aplicada_em timestamptz(6);
BEGIN
  IF TG_TABLE_NAME='ConciliacaoFinanceiraMigracao' THEN
    proposta_id:=NEW."propostaId";
  ELSIF NEW.status IN ('APROVADA','APLICADA') THEN
    proposta_id:=NEW.id;
  ELSE
    RETURN NULL;
  END IF;

  SELECT p.status,p."aplicadaEm" INTO estado,aplicada_em
  FROM "PropostaConciliacaoFinanceiraMigracao" p
  WHERE p.id=proposta_id;

  IF estado IS DISTINCT FROM 'APLICADA' OR aplicada_em IS NULL
     OR NOT EXISTS (SELECT 1 FROM "ConciliacaoFinanceiraMigracao" a WHERE a."propostaId"=proposta_id) THEN
    RAISE EXCEPTION 'Aplicação financeira M01 exige proposta aplicada e aplicação correspondente no mesmo commit';
  END IF;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER "conciliacao_financeira_migracao_commit_guard"
AFTER INSERT ON "ConciliacaoFinanceiraMigracao"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION "conferir_commit_conciliacao_financeira_migracao"();

CREATE CONSTRAINT TRIGGER "proposta_conciliacao_financeira_migracao_commit_guard"
AFTER UPDATE ON "PropostaConciliacaoFinanceiraMigracao"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION "conferir_commit_conciliacao_financeira_migracao"();