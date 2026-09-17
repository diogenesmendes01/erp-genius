-- DCT03: a alteração da taxa de matrícula é um acerto vinculado ao aditivo,
-- não uma reativação nem uma nova emissão. Q87 continua proprietário de recebimentos.
BEGIN;

CREATE TYPE "StatusPropostaAcertoTaxaAditivo" AS ENUM ('PENDENTE','APROVADA','REJEITADA','APLICADA','OBSOLETA');

CREATE TABLE "PropostaAcertoTaxaAditivo" (
  id TEXT PRIMARY KEY,
  "matriculaId" TEXT NOT NULL REFERENCES "Matricula"(id) ON DELETE RESTRICT,
  "propostaAditivoId" TEXT NOT NULL REFERENCES "PropostaAditivoContratual"(id) ON DELETE RESTRICT,
  "conferenciaFinalId" TEXT NOT NULL REFERENCES "ConferenciaFinalAditivo"(id) ON DELETE RESTRICT,
  "versaoCondicoesId" TEXT NOT NULL REFERENCES "VersaoCondicoesAditivo"(id) ON DELETE RESTRICT,
  "cobrancaId" TEXT NOT NULL REFERENCES "Cobranca"(id) ON DELETE RESTRICT,
  "preparadorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT,
  status "StatusPropostaAcertoTaxaAditivo" NOT NULL DEFAULT 'PENDENTE',
  "valorNovo" DECIMAL(12,2) NOT NULL CHECK ("valorNovo" >= 0),
  "vencimentoNovo" DATE NOT NULL,
  "creditoAnterior" DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK ("creditoAnterior" >= 0),
  "creditoNovo" DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK ("creditoNovo" >= 0),
  evidencia JSONB NOT NULL,
  motivo TEXT NOT NULL CHECK (length(btrim(motivo)) BETWEEN 5 AND 2000),
  fotografia JSONB NOT NULL,
  "fotografiaHash" TEXT NOT NULL CHECK ("fotografiaHash" ~ '^[a-f0-9]{64}$'),
  "chaveIdempotencia" TEXT NOT NULL CHECK (length(btrim("chaveIdempotencia")) BETWEEN 1 AND 200),
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  UNIQUE ("versaoCondicoesId", "cobrancaId", "fotografiaHash"),
  UNIQUE ("preparadorId", "chaveIdempotencia")
);
CREATE INDEX "PropostaAcertoTaxaAditivo_matriculaId_criadaEm_idx" ON "PropostaAcertoTaxaAditivo"("matriculaId","criadaEm");
CREATE UNIQUE INDEX "PropostaAcertoTaxaAditivo_ativa_por_versao_cobranca" ON "PropostaAcertoTaxaAditivo"("versaoCondicoesId","cobrancaId") WHERE status IN ('PENDENTE','APROVADA');

CREATE TABLE "DecisaoAcertoTaxaAditivo" (
  id TEXT PRIMARY KEY,
  "propostaId" TEXT NOT NULL UNIQUE REFERENCES "PropostaAcertoTaxaAditivo"(id) ON DELETE RESTRICT,
  "decisorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT,
  aprovada BOOLEAN NOT NULL,
  motivo TEXT NOT NULL CHECK (length(btrim(motivo)) BETWEEN 5 AND 2000),
  "fotografiaHash" TEXT NOT NULL CHECK ("fotografiaHash" ~ '^[a-f0-9]{64}$'),
  "chaveIdempotencia" TEXT NOT NULL CHECK (length(btrim("chaveIdempotencia")) BETWEEN 1 AND 200),
  "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  UNIQUE ("decisorId", "chaveIdempotencia")
);

CREATE TABLE "AplicacaoAcertoTaxaAditivo" (
  id TEXT PRIMARY KEY,
  "propostaId" TEXT NOT NULL UNIQUE REFERENCES "PropostaAcertoTaxaAditivo"(id) ON DELETE RESTRICT,
  "decisaoId" TEXT NOT NULL UNIQUE REFERENCES "DecisaoAcertoTaxaAditivo"(id) ON DELETE RESTRICT,
  "cobrancaId" TEXT NOT NULL REFERENCES "Cobranca"(id) ON DELETE RESTRICT,
  "executorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT,
  "versaoAnterior" INTEGER NOT NULL CHECK ("versaoAnterior" > 0),
  "valorAnterior" DECIMAL(12,2) NOT NULL,
  "valorNovo" DECIMAL(12,2) NOT NULL,
  "vencimentoAnterior" DATE NOT NULL,
  "vencimentoNovo" DATE NOT NULL,
  "creditoAnterior" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "creditoNovo" DECIMAL(12,2) NOT NULL DEFAULT 0,
  fotografia JSONB NOT NULL,
  "aplicadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  UNIQUE ("cobrancaId", "versaoAnterior")
);

CREATE TABLE "OrigemCreditoAcertoTaxaAditivo" (
  id TEXT PRIMARY KEY,
  "aplicacaoId" TEXT NOT NULL UNIQUE REFERENCES "AplicacaoAcertoTaxaAditivo"(id) ON DELETE RESTRICT,
  "matriculaId" TEXT NOT NULL REFERENCES "Matricula"(id) ON DELETE RESTRICT,
  "cobrancaId" TEXT NOT NULL UNIQUE REFERENCES "Cobranca"(id) ON DELETE RESTRICT,
  valor DECIMAL(12,2) NOT NULL CHECK (valor > 0),
  moeda TEXT NOT NULL,
  fotografia JSONB NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
);

-- Q211 já incluiu origemDestinacaoRecebimentoId. Esta quinta origem é aditiva;
-- não modifica recebimento, destinação ou a projeção de saldos daquele fluxo.
ALTER TABLE "CreditoMatricula" ADD COLUMN "origemAcertoTaxaAditivoId" TEXT UNIQUE REFERENCES "OrigemCreditoAcertoTaxaAditivo"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "CreditoMatricula" DROP CONSTRAINT "credito_matricula_origem_unica_check";
ALTER TABLE "CreditoMatricula" ADD CONSTRAINT "credito_matricula_origem_unica_check" CHECK (num_nonnulls("origemLiberacaoId","origemAcertoId","origemPeriodoIntegralId","origemDestinacaoRecebimentoId","origemAcertoTaxaAditivoId") = 1);

CREATE FUNCTION "dct03_acerto_taxa_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaAcertoTaxaAditivo"%ROWTYPE; c "Cobranca"%ROWTYPE; d "DecisaoAcertoTaxaAditivo"%ROWTYPE; v "VersaoCondicoesAditivo"%ROWTYPE; u "Usuario"%ROWTYPE; credito_anterior NUMERIC; credito_total NUMERIC;
BEGIN
  IF TG_TABLE_NAME = 'PropostaAcertoTaxaAditivo' THEN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Proposta de acerto de taxa é imutável'; END IF;
    IF TG_OP = 'UPDATE' THEN
      IF (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') THEN RAISE EXCEPTION 'Fotografia e valores do acerto são imutáveis'; END IF;
      IF OLD.status='PENDENTE' AND NEW.status='REJEITADA' AND EXISTS (SELECT 1 FROM "DecisaoAcertoTaxaAditivo" x WHERE x."propostaId"=NEW.id AND NOT x.aprovada AND x."fotografiaHash"=NEW."fotografiaHash") THEN RETURN NEW; END IF;
      IF OLD.status='PENDENTE' AND NEW.status='APROVADA' AND EXISTS (SELECT 1 FROM "DecisaoAcertoTaxaAditivo" x WHERE x."propostaId"=NEW.id AND x.aprovada AND x."fotografiaHash"=NEW."fotografiaHash") THEN RETURN NEW; END IF;
      IF OLD.status='APROVADA' AND NEW.status='APLICADA' AND EXISTS (SELECT 1 FROM "AplicacaoAcertoTaxaAditivo" x WHERE x."propostaId"=NEW.id) THEN RETURN NEW; END IF;
      IF OLD.status='PENDENTE' AND NEW.status='OBSOLETA' THEN RETURN NEW; END IF;
      RAISE EXCEPTION 'Transição de estado não corresponde à decisão ou aplicação';
    END IF;
    SELECT * INTO u FROM "Usuario" WHERE id=NEW."preparadorId" FOR SHARE;
    SELECT * INTO c FROM "Cobranca" WHERE id=NEW."cobrancaId" FOR SHARE;
    SELECT * INTO v FROM "VersaoCondicoesAditivo" WHERE id=NEW."versaoCondicoesId" FOR SHARE;
    IF u.id IS NULL OR NOT u.ativo OR NOT ('FINANCEIRO'=ANY(u.papeis)) THEN RAISE EXCEPTION 'Proposta exige Financeiro ativo'; END IF;
    IF c.id IS NULL OR c."matriculaId" IS DISTINCT FROM NEW."matriculaId" OR c.tipo <> 'MATRICULA' THEN RAISE EXCEPTION 'Acerto exige cobrança real de taxa da mesma matrícula'; END IF;
    IF v.id IS NULL OR v."matriculaId" IS DISTINCT FROM NEW."matriculaId" OR v."propostaId" IS DISTINCT FROM NEW."propostaAditivoId" OR v."conferenciaFinalId" IS DISTINCT FROM NEW."conferenciaFinalId" OR NOT (v.condicoes ?| ARRAY['TAXA_VALOR','TAXA_VENCIMENTO']) THEN RAISE EXCEPTION 'A versão formalizada não contém alteração de taxa verificável'; END IF;
    IF (
      (v.condicoes ? 'TAXA_VALOR' AND (
        (v.condicoes->'TAXA_VALOR'->>'tipo') IS DISTINCT FROM 'DINHEIRO'
        OR (v.condicoes->'TAXA_VALOR'->>'moeda') IS DISTINCT FROM c.moeda
        OR (v.condicoes->'TAXA_VALOR'->>'valor')::numeric IS DISTINCT FROM NEW."valorNovo"
      )) OR
      (NOT (v.condicoes ? 'TAXA_VALOR') AND c."valorNegociado" IS DISTINCT FROM NEW."valorNovo") OR
      (v.condicoes ? 'TAXA_VENCIMENTO' AND (
        (v.condicoes->'TAXA_VENCIMENTO'->>'tipo') IS DISTINCT FROM 'DATA'
        OR (v.condicoes->'TAXA_VENCIMENTO'->>'data')::date IS DISTINCT FROM NEW."vencimentoNovo"
      )) OR
      (NOT (v.condicoes ? 'TAXA_VENCIMENTO') AND c.vencimento::date IS DISTINCT FROM NEW."vencimentoNovo")
    ) THEN RAISE EXCEPTION 'Valor ou vencimento não corresponde às condições formalizadas'; END IF;
    SELECT coalesce(sum(o.valor),0) INTO credito_anterior FROM "OrigemCreditoAcertoTaxaAditivo" o WHERE o."cobrancaId"=c.id;
    credito_total := greatest(0,coalesce(c."valorRecebido",0)-NEW."valorNovo");
    IF NEW."creditoAnterior" IS DISTINCT FROM credito_anterior OR credito_total < credito_anterior THEN RAISE EXCEPTION 'Aumento posterior exige conciliar crédito de taxa já originado'; END IF;
    IF NEW."creditoNovo" IS DISTINCT FROM credito_total-credito_anterior THEN RAISE EXCEPTION 'Crédito novo não corresponde ao excedente ainda não originado'; END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'DecisaoAcertoTaxaAditivo' THEN
    IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisão de acerto de taxa é imutável'; END IF;
    SELECT * INTO p FROM "PropostaAcertoTaxaAditivo" WHERE id=NEW."propostaId" FOR UPDATE;
    SELECT * INTO u FROM "Usuario" WHERE id=NEW."decisorId" FOR SHARE;
    IF p.id IS NULL OR p.status <> 'PENDENTE' OR p."preparadorId"=NEW."decisorId" OR p."fotografiaHash" IS DISTINCT FROM NEW."fotografiaHash" OR u.id IS NULL OR NOT u.ativo OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND 'financeiro.aprovar_acertos'=ANY(u.permissoes))) THEN RAISE EXCEPTION 'Decisão exige aprovador financeiro ativo e independente'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Aplicação de acerto de taxa é imutável'; END IF;
  SELECT * INTO p FROM "PropostaAcertoTaxaAditivo" WHERE id=NEW."propostaId" FOR UPDATE;
  SELECT * INTO d FROM "DecisaoAcertoTaxaAditivo" WHERE id=NEW."decisaoId" FOR SHARE;
  SELECT * INTO c FROM "Cobranca" WHERE id=NEW."cobrancaId" FOR UPDATE;
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."executorId" FOR SHARE;
  IF p.id IS NULL OR d.id IS NULL OR c.id IS NULL OR u.id IS NULL OR NOT u.ativo OR NEW."executorId" IS DISTINCT FROM d."decisorId" OR d."propostaId" IS DISTINCT FROM p.id OR NOT d.aprovada OR p.status <> 'APROVADA' OR c.id IS DISTINCT FROM p."cobrancaId" OR c.versao IS DISTINCT FROM NEW."versaoAnterior" OR c."valorNegociado" IS DISTINCT FROM NEW."valorAnterior" OR c.vencimento::date IS DISTINCT FROM NEW."vencimentoAnterior" OR NEW."valorNovo" IS DISTINCT FROM p."valorNovo" OR NEW."vencimentoNovo" IS DISTINCT FROM p."vencimentoNovo" OR NEW."creditoAnterior" IS DISTINCT FROM p."creditoAnterior" OR NEW."creditoNovo" IS DISTINCT FROM p."creditoNovo" OR c.tipo <> 'MATRICULA' THEN RAISE EXCEPTION 'Aplicação não corresponde ao acerto aprovado e atual'; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "dct03_proposta_acerto_taxa_guard" BEFORE INSERT OR UPDATE OR DELETE ON "PropostaAcertoTaxaAditivo" FOR EACH ROW EXECUTE FUNCTION "dct03_acerto_taxa_guard"();
CREATE TRIGGER "dct03_decisao_acerto_taxa_guard" BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoAcertoTaxaAditivo" FOR EACH ROW EXECUTE FUNCTION "dct03_acerto_taxa_guard"();
CREATE TRIGGER "dct03_aplicacao_acerto_taxa_guard" BEFORE INSERT OR UPDATE OR DELETE ON "AplicacaoAcertoTaxaAditivo" FOR EACH ROW EXECUTE FUNCTION "dct03_acerto_taxa_guard"();

CREATE FUNCTION "dct03_conferir_origem_credito_taxa"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a "AplicacaoAcertoTaxaAditivo"%ROWTYPE; p "PropostaAcertoTaxaAditivo"%ROWTYPE; c "Cobranca"%ROWTYPE; esperado NUMERIC; credito_anterior NUMERIC;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Origem de crédito do acerto de taxa é imutável'; END IF;
  SELECT * INTO a FROM "AplicacaoAcertoTaxaAditivo" WHERE id=NEW."aplicacaoId" FOR SHARE;
  SELECT * INTO p FROM "PropostaAcertoTaxaAditivo" WHERE id=a."propostaId" FOR SHARE;
  SELECT * INTO c FROM "Cobranca" WHERE id=a."cobrancaId" FOR SHARE;
  SELECT coalesce(sum(o.valor),0) INTO credito_anterior FROM "OrigemCreditoAcertoTaxaAditivo" o WHERE o."cobrancaId"=c.id;
  esperado := greatest(0,coalesce(c."valorRecebido",0)-p."valorNovo")-credito_anterior;
  IF a.id IS NULL OR p.id IS NULL OR c.id IS NULL OR NEW."matriculaId" IS DISTINCT FROM p."matriculaId" OR NEW."cobrancaId" IS DISTINCT FROM c.id OR NEW.moeda IS DISTINCT FROM c.moeda OR esperado <= 0 OR NEW.valor IS DISTINCT FROM esperado OR NEW.valor IS DISTINCT FROM p."creditoNovo" THEN RAISE EXCEPTION 'Crédito não corresponde ao excedente incremental do acerto de taxa aprovado'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "dct03_origem_credito_taxa_guard" BEFORE INSERT OR UPDATE OR DELETE ON "OrigemCreditoAcertoTaxaAditivo" FOR EACH ROW EXECUTE FUNCTION "dct03_conferir_origem_credito_taxa"();

CREATE FUNCTION "dct03_conferir_credito_taxa"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE o "OrigemCreditoAcertoTaxaAditivo"%ROWTYPE;
BEGIN
  SELECT * INTO o FROM "OrigemCreditoAcertoTaxaAditivo" WHERE id=NEW."origemAcertoTaxaAditivoId" FOR SHARE;
  IF o.id IS NULL OR NEW."matriculaId" IS DISTINCT FROM o."matriculaId" OR NEW.moeda IS DISTINCT FROM o.moeda OR NEW."valorInicial" IS DISTINCT FROM o.valor THEN RAISE EXCEPTION 'Crédito diverge da origem do acerto de taxa'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "dct03_credito_taxa_guard" BEFORE INSERT ON "CreditoMatricula" FOR EACH ROW WHEN (NEW."origemAcertoTaxaAditivoId" IS NOT NULL) EXECUTE FUNCTION "dct03_conferir_credito_taxa"();

CREATE FUNCTION "dct03_conferir_aplicacao_taxa_final"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a "AplicacaoAcertoTaxaAditivo"%ROWTYPE; p "PropostaAcertoTaxaAditivo"%ROWTYPE; c "Cobranca"%ROWTYPE; esperado_credito NUMERIC; esperado_saldo NUMERIC; credito_total NUMERIC;
BEGIN
  SELECT * INTO a FROM "AplicacaoAcertoTaxaAditivo" WHERE id=NEW.id FOR SHARE;
  SELECT * INTO p FROM "PropostaAcertoTaxaAditivo" WHERE id=a."propostaId" FOR SHARE;
  SELECT * INTO c FROM "Cobranca" WHERE id=a."cobrancaId" FOR SHARE;
  esperado_credito := greatest(0,coalesce(c."valorRecebido",0)-a."valorNovo");
  esperado_saldo := greatest(0,a."valorNovo"-coalesce(c."valorRecebido",0)-c."valorLiquidadoCredito");
  SELECT coalesce(sum(o.valor),0) INTO credito_total FROM "OrigemCreditoAcertoTaxaAditivo" o WHERE o."cobrancaId"=a."cobrancaId";
  IF p.status <> 'APLICADA' OR c."valorNegociado" IS DISTINCT FROM a."valorNovo" OR c.vencimento::date IS DISTINCT FROM a."vencimentoNovo" OR c.saldo IS DISTINCT FROM esperado_saldo OR credito_total IS DISTINCT FROM esperado_credito OR (a."creditoNovo">0 AND NOT EXISTS (SELECT 1 FROM "OrigemCreditoAcertoTaxaAditivo" o JOIN "CreditoMatricula" cr ON cr."origemAcertoTaxaAditivoId"=o.id WHERE o."aplicacaoId"=a.id AND o.valor=a."creditoNovo")) OR (a."creditoNovo"=0 AND EXISTS (SELECT 1 FROM "OrigemCreditoAcertoTaxaAditivo" o WHERE o."aplicacaoId"=a.id)) THEN RAISE EXCEPTION 'Aplicação de taxa não preserva o saldo ou crédito incremental aprovado'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "dct03_aplicacao_taxa_final_guard" AFTER INSERT ON "AplicacaoAcertoTaxaAditivo" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "dct03_conferir_aplicacao_taxa_final"();
COMMIT;
