-- FIN-02/Q158-Q159: cadeia imutável de revisões de uma cobrança.
BEGIN;
ALTER TABLE "PropostaPeriodoIntegral" ADD COLUMN versao INTEGER;
ALTER TABLE "PropostaPeriodoIntegral" ADD COLUMN "anteriorId" TEXT;
ALTER TABLE "PropostaPeriodoIntegral" DISABLE TRIGGER validar_proposta_periodo_integral;
WITH ordenadas AS (SELECT id, row_number() OVER (PARTITION BY "cobrancaId" ORDER BY "criadaEm",id)::integer n, lag(id) OVER (PARTITION BY "cobrancaId" ORDER BY "criadaEm",id) anterior FROM "PropostaPeriodoIntegral") UPDATE "PropostaPeriodoIntegral" p SET versao=o.n,"anteriorId"=o.anterior FROM ordenadas o WHERE o.id=p.id;
ALTER TABLE "PropostaPeriodoIntegral" ENABLE TRIGGER validar_proposta_periodo_integral;
ALTER TABLE "PropostaPeriodoIntegral" ALTER COLUMN versao SET NOT NULL;
ALTER TABLE "PropostaPeriodoIntegral" ADD CONSTRAINT "PropPeriodoIntegral_anterior_fkey" FOREIGN KEY ("anteriorId") REFERENCES "PropostaPeriodoIntegral"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
CREATE UNIQUE INDEX "PropPeriodoIntegral_anterior_key" ON "PropostaPeriodoIntegral"("anteriorId");
CREATE UNIQUE INDEX "PropPeriodoIntegral_cobranca_versao_key" ON "PropostaPeriodoIntegral"("cobrancaId",versao);
ALTER TABLE "AplicacaoPeriodoIntegral" DROP CONSTRAINT "AplicPeriodoIntegral_cobranca_key";
CREATE INDEX "AplicPeriodoIntegral_cobranca_idx" ON "AplicacaoPeriodoIntegral"("cobrancaId");

CREATE OR REPLACE FUNCTION validar_proposta_periodo_integral() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE u "Usuario"%ROWTYPE; cabeca "PropostaPeriodoIntegral"%ROWTYPE; decisao "DecisaoPeriodoIntegral"%ROWTYPE; possui_aplicacao boolean; tem_cabeca boolean; cobertura_invalida boolean:=false;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Propostas de período integral são preservadas.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 PERFORM id FROM "Matricula" WHERE id=NEW."matriculaId" FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Matrícula do período integral não encontrada.'; END IF;
 PERFORM id FROM "Cobranca" WHERE id=NEW."cobrancaId" AND "matriculaId"=NEW."matriculaId" FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cobrança do período integral não encontrada.'; END IF;
 PERFORM id FROM "Documento" WHERE id=NEW."documentoId" FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Documento do período integral não encontrado.'; END IF;
 SELECT * INTO cabeca FROM "PropostaPeriodoIntegral" WHERE "cobrancaId"=NEW."cobrancaId" ORDER BY versao DESC FOR UPDATE LIMIT 1;
 tem_cabeca:=FOUND;
 SELECT * INTO u FROM "Usuario" WHERE id=NEW."autorId" FOR SHARE;
 IF u.ativo IS DISTINCT FROM true OR NOT(u.papeis && ARRAY['FINANCEIRO','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Sem permissão para preparar período integral.'; END IF;
 IF NOT tem_cabeca THEN
  IF NEW.versao<>1 OR NEW."anteriorId" IS NOT NULL THEN RAISE EXCEPTION 'A primeira proposta integral exige versão inicial.'; END IF;
 ELSE
  IF NEW.versao<>cabeca.versao+1 OR NEW."anteriorId" IS DISTINCT FROM cabeca.id THEN RAISE EXCEPTION 'A revisão deve apontar a última proposta da cobrança.'; END IF;
  SELECT * INTO decisao FROM "DecisaoPeriodoIntegral" WHERE "propostaId"=cabeca.id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Existe proposta integral pendente.'; END IF;
  SELECT EXISTS(SELECT 1 FROM "AplicacaoPeriodoIntegral" WHERE "decisaoId"=decisao.id) INTO possui_aplicacao;
  IF decisao.aprovada AND possui_aplicacao AND cabeca.escolha<>'COBERTURA_FUTURA' THEN RAISE EXCEPTION 'Aplicação de crédito encerra a cobrança para novas revisões.'; END IF;
  IF decisao.aprovada AND NOT possui_aplicacao AND (NEW.snapshot - 'memoria') = (cabeca.snapshot - 'memoria') AND (NEW.snapshot->'memoria' - ARRAY['escolha','saldoADesobrigar','creditoPorRecebimentos','creditoPorLiquidacaoPrevia','creditoAConstituir','saldoAConservar','transferenciaCoberturaPendente']) = (cabeca.snapshot->'memoria' - ARRAY['escolha','saldoADesobrigar','creditoPorRecebimentos','creditoPorLiquidacaoPrevia','creditoAConstituir','saldoAConservar','transferenciaCoberturaPendente']) THEN
   BEGIN PERFORM conferir_cobertura_futura_periodo_integral_67(cabeca); EXCEPTION WHEN raise_exception THEN cobertura_invalida:=true; END;
   IF NOT cobertura_invalida THEN RAISE EXCEPTION 'Aprovação vigente exige mudança de snapshot para nova revisão.'; END IF;
  END IF;
 END IF;
 IF length(trim(NEW.clausula)) NOT BETWEEN 5 AND 2000 OR length(trim(NEW."evidenciaEscolha")) NOT BETWEEN 5 AND 2000 OR length(trim(NEW.motivo)) NOT BETWEEN 5 AND 2000 OR length(trim(NEW."chaveIdempotencia")) NOT BETWEEN 8 AND 100 OR NEW."snapshotHash" !~ '^[a-f0-9]{64}$' OR NEW."entradaHash" !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Dados da proposta de período integral inválidos.'; END IF;
 PERFORM conferir_base_periodo_integral_67(NEW); PERFORM conferir_cobertura_futura_periodo_integral_67(NEW);
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION validar_decisao_periodo_integral() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaPeriodoIntegral"%ROWTYPE; u "Usuario"%ROWTYPE;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisões de período integral são preservadas.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 PERFORM m.id FROM "Matricula" m JOIN "PropostaPeriodoIntegral" p0 ON p0."matriculaId"=m.id WHERE p0.id=NEW."propostaId" FOR UPDATE OF m;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proposta do período integral não encontrada.'; END IF;
 PERFORM c.id FROM "Cobranca" c JOIN "PropostaPeriodoIntegral" p0 ON p0."cobrancaId"=c.id AND p0."matriculaId"=c."matriculaId" WHERE p0.id=NEW."propostaId" FOR UPDATE OF c;
 PERFORM doc.id FROM "Documento" doc JOIN "PropostaPeriodoIntegral" p0 ON p0."documentoId"=doc.id WHERE p0.id=NEW."propostaId" FOR SHARE OF doc;
 SELECT * INTO p FROM "PropostaPeriodoIntegral" WHERE id=NEW."propostaId" FOR UPDATE;
 IF EXISTS(SELECT 1 FROM "PropostaPeriodoIntegral" s WHERE s."anteriorId"=p.id) THEN RAISE EXCEPTION 'Proposta substituída por revisão posterior não pode ser decidida.'; END IF;
 SELECT * INTO u FROM "Usuario" WHERE id=NEW."decisorId" FOR SHARE;
 IF u.ativo IS DISTINCT FROM true OR NOT('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND 'financeiro.aprovar_acertos'=ANY(u.permissoes))) THEN RAISE EXCEPTION 'Sem permissão de aprovação financeira do período integral.'; END IF;
 IF NEW."decisorId" IS NOT DISTINCT FROM p."autorId" THEN RAISE EXCEPTION 'Outra pessoa deve decidir o período integral.'; END IF;
 IF length(trim(NEW.motivo)) NOT BETWEEN 5 AND 2000 OR NEW."entradaHash" !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Dados da decisão de período integral inválidos.'; END IF;
 IF NEW.aprovada THEN PERFORM conferir_base_periodo_integral_67(p); PERFORM conferir_cobertura_futura_periodo_integral_67(p); END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION conferir_cabeca_aplicacao_periodo_integral_820() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaPeriodoIntegral"%ROWTYPE;
BEGIN
 SELECT p0.* INTO p FROM "PropostaPeriodoIntegral" p0 JOIN "DecisaoPeriodoIntegral" d ON d."propostaId"=p0.id WHERE d.id=NEW."decisaoId" FOR SHARE;
 IF EXISTS(SELECT 1 FROM "PropostaPeriodoIntegral" s WHERE s."anteriorId"=p.id) THEN RAISE EXCEPTION 'Proposta substituída por revisão posterior não pode ser aplicada.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_cabeca_aplicacao_periodo_integral_820 BEFORE INSERT ON "AplicacaoPeriodoIntegral" FOR EACH ROW EXECUTE FUNCTION conferir_cabeca_aplicacao_periodo_integral_820();

COMMIT;
