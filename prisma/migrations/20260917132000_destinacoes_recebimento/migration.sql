BEGIN;

-- FIN-04/Q87: caixa é um fato único; baixa de cobrança e crédito são suas
-- destinações. O vínculo singular permanece apenas para leitura de legado.
CREATE TYPE "TipoDestinacaoRecebimento" AS ENUM ('COBRANCA', 'CREDITO_SEM_DESTINO');

ALTER TABLE "Recebimento" ALTER COLUMN "cobrancaId" DROP NOT NULL;
ALTER TABLE "Recebimento" ADD COLUMN "titularMatriculaId" text, ADD COLUMN "pagadorId" text;
ALTER TABLE "Recebimento"
  ADD CONSTRAINT "Recebimento_titularMatriculaId_fkey" FOREIGN KEY ("titularMatriculaId") REFERENCES "Matricula"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "Recebimento_pagadorId_fkey" FOREIGN KEY ("pagadorId") REFERENCES "PagadorPreparacaoMatricula"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- O titular vem somente da cobrança que já era registrada. Pagador e evidência
-- não eram fatos do legado e permanecem ausentes em vez de serem inventados.
UPDATE "Recebimento" r SET "titularMatriculaId" = c."matriculaId" FROM "Cobranca" c WHERE c.id = r."cobrancaId";
ALTER TABLE "Recebimento" ALTER COLUMN "titularMatriculaId" SET NOT NULL;
CREATE INDEX "Recebimento_titularMatriculaId_idx" ON "Recebimento"("titularMatriculaId");
CREATE INDEX "Recebimento_pagadorId_idx" ON "Recebimento"("pagadorId");

CREATE TABLE "DestinacaoRecebimento" (
  id text PRIMARY KEY,
  "recebimentoId" text NOT NULL REFERENCES "Recebimento"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "cobrancaId" text REFERENCES "Cobranca"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "autorId" text NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  tipo "TipoDestinacaoRecebimento" NOT NULL,
  valor numeric(12,2) NOT NULL CHECK (valor > 0),
  evidencia text,
  "origemLegada" boolean NOT NULL DEFAULT false,
  "chaveIdempotencia" text NOT NULL,
  "criadaEm" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DestinacaoRecebimento_tipo_destino_check" CHECK ((tipo = 'COBRANCA' AND "cobrancaId" IS NOT NULL) OR (tipo = 'CREDITO_SEM_DESTINO' AND "cobrancaId" IS NULL)),
  CONSTRAINT "DestinacaoRecebimento_evidencia_nova_check" CHECK ("origemLegada" OR (evidencia IS NOT NULL AND length(btrim(evidencia)) >= 5)),
  CONSTRAINT "DestinacaoRecebimento_recebimento_chave_key" UNIQUE ("recebimentoId", "chaveIdempotencia")
);
CREATE INDEX "DestinacaoRecebimento_cobrancaId_idx" ON "DestinacaoRecebimento"("cobrancaId");
INSERT INTO "DestinacaoRecebimento" (id, "recebimentoId", "cobrancaId", "autorId", tipo, valor, evidencia, "origemLegada", "chaveIdempotencia", "criadaEm")
SELECT 'legado-211:' || r.id, r.id, r."cobrancaId", r."autorId", 'COBRANCA', r.valor, NULL, true, 'legado-211:' || r.id, r."criadoEm"
FROM "Recebimento" r WHERE r."cobrancaId" IS NOT NULL;

ALTER TABLE "CreditoMatricula" ADD COLUMN "origemDestinacaoRecebimentoId" text UNIQUE REFERENCES "DestinacaoRecebimento"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = '"CreditoMatricula"'::regclass AND pg_get_constraintdef(oid) LIKE '%num_nonnulls%' LOOP
    EXECUTE format('ALTER TABLE "CreditoMatricula" DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE "CreditoMatricula" ADD CONSTRAINT "credito_matricula_origem_unica_check" CHECK (num_nonnulls("origemLiberacaoId", "origemAcertoId", "origemPeriodoIntegralId", "origemDestinacaoRecebimentoId") = 1);

CREATE OR REPLACE FUNCTION "conferir_recebimento_fin04_211"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE u "Usuario"%ROWTYPE; p "PagadorPreparacaoMatricula"%ROWTYPE; i "PagamentoInformado"%ROWTYPE; c "Cobranca"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Recebimento original é imutável; use destinações, crédito ou devolução.'; END IF;
  IF NEW."cobrancaId" IS NOT NULL THEN RAISE EXCEPTION 'Novo recebimento não usa cobrança singular; registre as destinações.'; END IF;
  SELECT * INTO u FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
  IF NOT FOUND OR NOT u.ativo OR NOT ('ADMINISTRADOR' = ANY(u.papeis) OR 'FINANCEIRO' = ANY(u.papeis) OR 'pagamento.caixa' = ANY(u.permissoes)) THEN RAISE EXCEPTION 'Recebimento exige autor financeiro ativo ou capacidade de caixa vigente.'; END IF;
  IF NEW.valor <= 0 OR NEW.moeda !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Recebimento exige valor positivo e moeda ISO preservada.'; END IF;
  IF NEW."pagadorId" IS NOT NULL THEN
    SELECT * INTO p FROM "PagadorPreparacaoMatricula" WHERE id = NEW."pagadorId" FOR SHARE;
    IF NOT FOUND OR p."matriculaId" IS DISTINCT FROM NEW."titularMatriculaId" THEN RAISE EXCEPTION 'Pagador do recebimento deve pertencer ao titular explícito.'; END IF;
  END IF;
  IF NEW."informeId" IS NOT NULL THEN
    SELECT * INTO i FROM "PagamentoInformado" WHERE id = NEW."informeId" FOR SHARE;
    SELECT * INTO c FROM "Cobranca" WHERE id = i."cobrancaId" FOR SHARE;
    IF NOT FOUND OR c."matriculaId" IS DISTINCT FROM NEW."titularMatriculaId" OR i.valor IS DISTINCT FROM NEW.valor OR i.moeda IS DISTINCT FROM NEW.moeda OR i.forma IS DISTINCT FROM NEW.forma OR i."dataPagamento" IS DISTINCT FROM NEW."dataPagamento" THEN RAISE EXCEPTION 'Informe não corresponde ao recebimento original preservado.'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "recebimento_fin04_211_guard" BEFORE INSERT OR UPDATE OR DELETE ON "Recebimento" FOR EACH ROW EXECUTE FUNCTION "conferir_recebimento_fin04_211"();

CREATE OR REPLACE FUNCTION "conferir_destinacao_recebimento_fin04_211"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "Recebimento"%ROWTYPE; c "Cobranca"%ROWTYPE; u "Usuario"%ROWTYPE; destinado numeric;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Destinação de recebimento é imutável.'; END IF;
  IF NEW."origemLegada" THEN RAISE EXCEPTION 'Origem legada só pode ser criada pela migração.'; END IF;
  SELECT * INTO r FROM "Recebimento" WHERE id = NEW."recebimentoId" FOR UPDATE;
  SELECT * INTO u FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
  IF NOT FOUND OR r."titularMatriculaId" IS NULL OR NOT u.ativo OR NOT ('ADMINISTRADOR' = ANY(u.papeis) OR 'FINANCEIRO' = ANY(u.papeis) OR 'pagamento.caixa' = ANY(u.permissoes)) THEN RAISE EXCEPTION 'Destinação exige recebimento com titular e autor de caixa vigente.'; END IF;
  IF NEW.evidencia IS NULL OR length(btrim(NEW.evidencia)) < 5 THEN RAISE EXCEPTION 'Destinação nova exige evidência identificada.'; END IF;
  IF NEW.tipo = 'COBRANCA' THEN
    SELECT * INTO c FROM "Cobranca" WHERE id = NEW."cobrancaId" FOR UPDATE;
    IF NOT FOUND OR c."matriculaId" IS DISTINCT FROM r."titularMatriculaId" OR c.moeda IS DISTINCT FROM r.moeda THEN RAISE EXCEPTION 'Destinação não pode trocar titular ou converter moeda.'; END IF;
  END IF;
  SELECT coalesce(sum(d.valor), 0) INTO destinado FROM "DestinacaoRecebimento" d WHERE d."recebimentoId" = NEW."recebimentoId";
  IF destinado + NEW.valor > r.valor THEN RAISE EXCEPTION 'Destinações excedem o valor do recebimento original.'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "destinacao_recebimento_fin04_211_guard" BEFORE INSERT OR UPDATE OR DELETE ON "DestinacaoRecebimento" FOR EACH ROW EXECUTE FUNCTION "conferir_destinacao_recebimento_fin04_211"();

CREATE OR REPLACE FUNCTION "conferir_credito_destinacao_fin04_211"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d "DestinacaoRecebimento"%ROWTYPE; r "Recebimento"%ROWTYPE;
BEGIN
  SELECT * INTO d FROM "DestinacaoRecebimento" WHERE id = NEW."origemDestinacaoRecebimentoId" FOR SHARE;
  SELECT * INTO r FROM "Recebimento" WHERE id = d."recebimentoId" FOR SHARE;
  IF NOT FOUND OR d.tipo IS DISTINCT FROM 'CREDITO_SEM_DESTINO' OR d."origemLegada" OR NEW."matriculaId" IS DISTINCT FROM r."titularMatriculaId" OR NEW.moeda IS DISTINCT FROM r.moeda OR NEW."valorInicial" IS DISTINCT FROM d.valor THEN RAISE EXCEPTION 'Crédito deve preservar valor, titular e moeda de uma destinação sem destino.'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "credito_destinacao_fin04_211_guard" BEFORE INSERT ON "CreditoMatricula" FOR EACH ROW WHEN (NEW."origemDestinacaoRecebimentoId" IS NOT NULL) EXECUTE FUNCTION "conferir_credito_destinacao_fin04_211"();

-- Cobranca.valorRecebido é a projeção das destinações. Q68 continua somando
-- somente decisões aprovadas de uso de crédito.
CREATE OR REPLACE FUNCTION "proteger_saldo_credito_cobranca"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE total_credito numeric; total_recebido numeric; saldo_esperado numeric;
BEGIN
  SELECT coalesce(sum(p.valor), 0) INTO total_credito FROM "PropostaUsoCredito" p JOIN "DecisaoUsoCredito" d ON d."propostaId" = p.id AND d.aprovada WHERE p."cobrancaId" = NEW.id;
  SELECT coalesce(sum(dest.valor), 0) INTO total_recebido FROM "DestinacaoRecebimento" dest WHERE dest."cobrancaId" = NEW.id;
  saldo_esperado := greatest(0, NEW."valorNegociado" - total_recebido - total_credito);
  IF NEW."valorLiquidadoCredito" IS DISTINCT FROM total_credito OR coalesce(NEW."valorRecebido", 0) IS DISTINCT FROM total_recebido OR (NEW.saldo IS NOT NULL AND NEW.saldo IS DISTINCT FROM saldo_esperado) OR (NEW.status = 'PAGO' AND saldo_esperado <> 0) THEN RAISE EXCEPTION 'Cobrança deve refletir somente destinações e créditos aprovados.'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "conferir_commit_destinacao_recebimento_fin04_211"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c "Cobranca"%ROWTYPE; total numeric;
BEGIN
  IF NEW.tipo = 'COBRANCA' THEN
    SELECT * INTO c FROM "Cobranca" WHERE id = NEW."cobrancaId" FOR SHARE;
    SELECT coalesce(sum(valor), 0) INTO total FROM "DestinacaoRecebimento" WHERE "cobrancaId" = NEW."cobrancaId";
    IF coalesce(c."valorRecebido", 0) IS DISTINCT FROM total THEN RAISE EXCEPTION 'Destinação exige atualizar o acumulado da cobrança na mesma transação.'; END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM "CreditoMatricula" cr WHERE cr."origemDestinacaoRecebimentoId" = NEW.id) THEN
    RAISE EXCEPTION 'Destinação sem destino exige crédito rastreável na mesma transação.';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "destinacao_recebimento_fin04_211_commit_guard" AFTER INSERT ON "DestinacaoRecebimento" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "conferir_commit_destinacao_recebimento_fin04_211"();

COMMIT;
