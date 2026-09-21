-- FIN-02/Q158-Q159: execução única da decisão aprovada; não cria recebimentos.
CREATE TABLE "AplicacaoPeriodoIntegral" (
 id TEXT PRIMARY KEY, "decisaoId" TEXT NOT NULL UNIQUE, "cobrancaId" TEXT NOT NULL, "matriculaId" TEXT NOT NULL,
 "executorId" TEXT NOT NULL, "aplicadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 snapshot JSONB NOT NULL, "snapshotHash" TEXT NOT NULL, "entradaHash" TEXT NOT NULL,
 CONSTRAINT "AplicPeriodoIntegral_cobranca_key" UNIQUE ("cobrancaId")
);
ALTER TABLE "AplicacaoPeriodoIntegral" ADD CONSTRAINT "AplicPeriodo_decisao_fkey" FOREIGN KEY ("decisaoId") REFERENCES "DecisaoPeriodoIntegral"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "AplicacaoPeriodoIntegral" ADD CONSTRAINT "AplicPeriodo_cobranca_matricula_fkey" FOREIGN KEY ("cobrancaId","matriculaId") REFERENCES "Cobranca"(id,"matriculaId") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "AplicacaoPeriodoIntegral" ADD CONSTRAINT "AplicPeriodo_matricula_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "AplicacaoPeriodoIntegral" ADD CONSTRAINT "AplicPeriodo_executor_fkey" FOREIGN KEY ("executorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "CreditoMatricula" ADD COLUMN "origemPeriodoIntegralId" TEXT UNIQUE REFERENCES "AplicacaoPeriodoIntegral"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT conname FROM pg_constraint WHERE conrelid='"CreditoMatricula"'::regclass AND pg_get_constraintdef(oid) LIKE '%num_nonnulls%' LOOP EXECUTE format('ALTER TABLE "CreditoMatricula" DROP CONSTRAINT %I',r.conname); END LOOP;
END $$;
ALTER TABLE "CreditoMatricula" ADD CONSTRAINT "credito_matricula_origem_unica_check" CHECK (num_nonnulls("origemLiberacaoId","origemAcertoId","origemPeriodoIntegralId") = 1);

CREATE FUNCTION conferir_aplicacao_periodo_integral() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaPeriodoIntegral"%ROWTYPE; d "DecisaoPeriodoIntegral"%ROWTYPE; u "Usuario"%ROWTYPE; c "Cobranca"%ROWTYPE; memoria jsonb; credito numeric;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Aplicações de período integral são preservadas.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 PERFORM m.id FROM "Matricula" m JOIN "PropostaPeriodoIntegral" p0 ON p0."matriculaId"=m.id JOIN "DecisaoPeriodoIntegral" d0 ON d0."propostaId"=p0.id WHERE d0.id=NEW."decisaoId" FOR UPDATE OF m;
 IF NOT FOUND THEN RAISE EXCEPTION 'Decisão do período integral não encontrada.'; END IF;
 PERFORM c0.id FROM "Cobranca" c0 JOIN "PropostaPeriodoIntegral" p0 ON p0."cobrancaId"=c0.id AND p0."matriculaId"=c0."matriculaId" JOIN "DecisaoPeriodoIntegral" d0 ON d0."propostaId"=p0.id WHERE d0.id=NEW."decisaoId" FOR UPDATE OF c0;
 SELECT p0.* INTO p FROM "PropostaPeriodoIntegral" p0 JOIN "DecisaoPeriodoIntegral" d0 ON d0."propostaId"=p0.id WHERE d0.id=NEW."decisaoId" FOR UPDATE OF p0;
 SELECT * INTO d FROM "DecisaoPeriodoIntegral" WHERE id=NEW."decisaoId" FOR SHARE;
 SELECT * INTO c FROM "Cobranca" WHERE id=p."cobrancaId" FOR UPDATE;
 PERFORM doc.id FROM "Documento" doc WHERE doc.id=p."documentoId" FOR SHARE;
 SELECT * INTO u FROM "Usuario" WHERE id=NEW."executorId" FOR SHARE;
 IF NOT d.aprovada OR u.ativo IS DISTINCT FROM true OR NOT (u.papeis && ARRAY['FINANCEIRO','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Aplicação exige decisão aprovada e executor financeiro ativo.'; END IF;
 IF NEW."matriculaId" IS DISTINCT FROM p."matriculaId" OR NEW."cobrancaId" IS DISTINCT FROM p."cobrancaId" OR NEW.snapshot IS DISTINCT FROM p.snapshot OR NEW."snapshotHash" IS DISTINCT FROM p."snapshotHash" OR NEW."snapshotHash" !~ '^[a-f0-9]{64}$' OR NEW."entradaHash" !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Aplicação diverge da decisão aprovada.'; END IF;
 IF p.escolha='CREDITO' AND (EXISTS (SELECT 1 FROM "OrigemCreditoAcerto" o WHERE o."origemTipo"='COBRANCA' AND o."origemId"=c.id) OR EXISTS (SELECT 1 FROM "AjusteCobrancaAcerto" a WHERE a."cobrancaId"=c.id)) THEN RAISE EXCEPTION 'Cobrança de crédito já possui acerto de encerramento.'; END IF;
 PERFORM conferir_base_periodo_integral_67(p);
 PERFORM conferir_cobertura_futura_periodo_integral_67(p);
 memoria:=p.snapshot->'memoria';
 IF p.escolha='CREDITO' THEN
  IF memoria->>'creditoAConstituir' !~ '^[0-9]+(\.[0-9]{1,2})?$' OR memoria->>'saldoADesobrigar' !~ '^[0-9]+(\.[0-9]{1,2})?$' THEN RAISE EXCEPTION 'Memória de crédito do período integral inválida.'; END IF;
  credito:=(memoria->>'creditoAConstituir')::numeric;
  IF credito IS DISTINCT FROM coalesce(c."valorRecebido",0)+c."valorLiquidadoCredito" OR (memoria->>'saldoADesobrigar')::numeric IS DISTINCT FROM greatest(0,c."valorNegociado"-coalesce(c."valorRecebido",0)-c."valorLiquidadoCredito") THEN RAISE EXCEPTION 'Memória financeira do período integral diverge da cobrança.'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_aplicacao_periodo_integral BEFORE INSERT OR UPDATE OR DELETE ON "AplicacaoPeriodoIntegral" FOR EACH ROW EXECUTE FUNCTION conferir_aplicacao_periodo_integral();

CREATE FUNCTION aplicar_periodo_integral() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaPeriodoIntegral"%ROWTYPE; c "Cobranca"%ROWTYPE;
BEGIN
 SELECT p0.* INTO p FROM "PropostaPeriodoIntegral" p0 JOIN "DecisaoPeriodoIntegral" d ON d."propostaId"=p0.id WHERE d.id=NEW."decisaoId";
 SELECT * INTO c FROM "Cobranca" WHERE id=NEW."cobrancaId" FOR UPDATE;
 IF p.escolha='CREDITO' THEN
  UPDATE "Cobranca" SET "valorNegociado"=coalesce(c."valorRecebido",0)+c."valorLiquidadoCredito", saldo=0, status='PAGO', "pagoEm"=coalesce(c."pagoEm",NEW."aplicadaEm"), versao=versao+1 WHERE id=c.id;
 ELSE
  UPDATE "Cobranca" SET "coberturaInicio"=p."coberturaFuturaInicio", "coberturaFim"=p."coberturaFuturaFim", versao=versao+1 WHERE id=c.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER aplicar_periodo_integral AFTER INSERT ON "AplicacaoPeriodoIntegral" FOR EACH ROW EXECUTE FUNCTION aplicar_periodo_integral();

CREATE FUNCTION conferir_credito_periodo_integral() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a "AplicacaoPeriodoIntegral"%ROWTYPE; p "PropostaPeriodoIntegral"%ROWTYPE; credito numeric;
BEGIN
 SELECT * INTO a FROM "AplicacaoPeriodoIntegral" WHERE id=NEW."origemPeriodoIntegralId" FOR SHARE;
 SELECT p0.* INTO p FROM "PropostaPeriodoIntegral" p0 JOIN "DecisaoPeriodoIntegral" d ON d."propostaId"=p0.id WHERE d.id=a."decisaoId" FOR SHARE;
 credito:=(p.snapshot->'memoria'->>'creditoAConstituir')::numeric;
 IF p.escolha<>'CREDITO' OR credito <= 0 OR NEW."matriculaId" IS DISTINCT FROM a."matriculaId" OR NEW.moeda IS DISTINCT FROM p.snapshot->'memoria'->>'moeda' OR NEW."valorInicial" IS DISTINCT FROM credito OR NEW."origemPeriodoIntegralId" IS NULL THEN RAISE EXCEPTION 'Crédito diverge da aplicação de período integral.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_credito_periodo_integral BEFORE INSERT ON "CreditoMatricula" FOR EACH ROW WHEN (NEW."origemPeriodoIntegralId" IS NOT NULL) EXECUTE FUNCTION conferir_credito_periodo_integral();

CREATE FUNCTION exigir_credito_periodo_integral() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaPeriodoIntegral"%ROWTYPE; credito numeric;
BEGIN
 SELECT p0.* INTO p FROM "PropostaPeriodoIntegral" p0 JOIN "DecisaoPeriodoIntegral" d ON d."propostaId"=p0.id WHERE d.id=NEW."decisaoId";
 IF p.escolha='CREDITO' THEN
  credito:=(p.snapshot->'memoria'->>'creditoAConstituir')::numeric;
  IF (credito>0 AND NOT EXISTS(SELECT 1 FROM "CreditoMatricula" c WHERE c."origemPeriodoIntegralId"=NEW.id)) OR (credito=0 AND EXISTS(SELECT 1 FROM "CreditoMatricula" c WHERE c."origemPeriodoIntegralId"=NEW.id)) THEN RAISE EXCEPTION 'Aplicação de crédito exige origem monetária coerente na mesma transação.'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER exigir_credito_periodo_integral AFTER INSERT ON "AplicacaoPeriodoIntegral" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION exigir_credito_periodo_integral();

CREATE FUNCTION impedir_reabertura_periodo_integral() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaPeriodoIntegral"%ROWTYPE;
BEGIN
 SELECT p0.* INTO p FROM "AplicacaoPeriodoIntegral" a JOIN "DecisaoPeriodoIntegral" d ON d.id=a."decisaoId" JOIN "PropostaPeriodoIntegral" p0 ON p0.id=d."propostaId" WHERE a."cobrancaId"=OLD.id AND p0.escolha='CREDITO';
 IF FOUND AND (NEW."matriculaId" IS DISTINCT FROM OLD."matriculaId" OR NEW.tipo IS DISTINCT FROM OLD.tipo OR NEW."valorOriginal" IS DISTINCT FROM OLD."valorOriginal" OR NEW."valorRecebido" IS DISTINCT FROM OLD."valorRecebido" OR NEW."valorLiquidadoCredito" IS DISTINCT FROM OLD."valorLiquidadoCredito" OR NEW.moeda IS DISTINCT FROM OLD.moeda OR NEW."coberturaInicio" IS DISTINCT FROM OLD."coberturaInicio" OR NEW."coberturaFim" IS DISTINCT FROM OLD."coberturaFim" OR NEW.vencimento IS DISTINCT FROM OLD.vencimento OR NEW."valorNegociado" IS DISTINCT FROM (p.snapshot->'memoria'->>'creditoAConstituir')::numeric OR NEW.saldo IS DISTINCT FROM 0 OR NEW.status IS DISTINCT FROM 'PAGO' OR NEW."pagoEm" IS NULL) THEN RAISE EXCEPTION 'Cobrança regularizada por crédito deve permanecer no estado financeiro final aprovado.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER impedir_reabertura_periodo_integral BEFORE UPDATE ON "Cobranca" FOR EACH ROW EXECUTE FUNCTION impedir_reabertura_periodo_integral();

CREATE FUNCTION impedir_recebimento_periodo_integral() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM "AplicacaoPeriodoIntegral" a JOIN "DecisaoPeriodoIntegral" d ON d.id=a."decisaoId" JOIN "PropostaPeriodoIntegral" p ON p.id=d."propostaId" WHERE a."cobrancaId"=NEW."cobrancaId" AND p.escolha='CREDITO') THEN RAISE EXCEPTION 'Cobrança regularizada por crédito não aceita novo recebimento.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER impedir_recebimento_periodo_integral BEFORE INSERT ON "Recebimento" FOR EACH ROW EXECUTE FUNCTION impedir_recebimento_periodo_integral();

CREATE FUNCTION impedir_origem_acerto_periodo_integral() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."origemTipo"='COBRANCA' AND EXISTS(SELECT 1 FROM "AplicacaoPeriodoIntegral" a JOIN "DecisaoPeriodoIntegral" d ON d.id=a."decisaoId" JOIN "PropostaPeriodoIntegral" p ON p.id=d."propostaId" WHERE a."cobrancaId"=NEW."origemId" AND p.escolha='CREDITO') THEN RAISE EXCEPTION 'Cobrança já possui aplicação de crédito por período integral.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER impedir_origem_acerto_periodo_integral BEFORE INSERT ON "OrigemCreditoAcerto" FOR EACH ROW EXECUTE FUNCTION impedir_origem_acerto_periodo_integral();
