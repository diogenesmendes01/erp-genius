-- M01/194: pendências históricas não impedem conciliação posterior comprovada.
-- Não modifica nem remove aplicações anteriores; apenas uma delas pode ter recebimento.
ALTER TABLE "ConciliacaoFinanceiraMigracao"
 DROP CONSTRAINT "ConciliacaoFinanceiraMigracao_origem_financeiro_key";
CREATE INDEX "ConciliacaoFinanceiraMigracao_origem_financeiro_idx"
 ON "ConciliacaoFinanceiraMigracao" (origem,"financeiroOrigemId");
CREATE UNIQUE INDEX "ConciliacaoFinanceiraMigracao_origem_recebida_key"
 ON "ConciliacaoFinanceiraMigracao" (origem,"financeiroOrigemId")
 WHERE "recebimentoId" IS NOT NULL;

CREATE UNIQUE INDEX "ConciliacaoFinanceiraMigracao_origem_pendente_key"
 ON "ConciliacaoFinanceiraMigracao" (origem,"financeiroOrigemId")
 WHERE "recebimentoId" IS NULL;

CREATE OR REPLACE FUNCTION "conferir_resolucao_pendencia_financeira_migracao"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('migracao-financeiro:'||NEW.origem||':'||NEW."financeiroOrigemId",0));
 IF EXISTS (SELECT 1 FROM "ConciliacaoFinanceiraMigracao" a
            WHERE a.origem=NEW.origem AND a."financeiroOrigemId"=NEW."financeiroOrigemId"
              AND a."recebimentoId" IS NOT NULL) THEN
   RAISE EXCEPTION 'Origem financeira já conciliada com recebimento; não pode receber nova aplicação ou voltar a pendência';
 END IF;
 IF NEW."recebimentoId" IS NULL AND EXISTS (
   SELECT 1 FROM "ConciliacaoFinanceiraMigracao" a WHERE a.origem=NEW.origem AND a."financeiroOrigemId"=NEW."financeiroOrigemId"
 ) THEN RAISE EXCEPTION 'A pendência desta origem já foi registrada; concilie o recebimento quando houver evidência'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "conciliacao_financeira_resolucao_guard"
 BEFORE INSERT ON "ConciliacaoFinanceiraMigracao"
 FOR EACH ROW EXECUTE FUNCTION "conferir_resolucao_pendencia_financeira_migracao"();