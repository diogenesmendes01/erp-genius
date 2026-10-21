-- Precedência explícita na comparação da memória JSONB de revisões.
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
  IF decisao.aprovada AND NOT possui_aplicacao AND (NEW.snapshot - 'memoria') = (cabeca.snapshot - 'memoria') AND ((NEW.snapshot->'memoria') - ARRAY['escolha','saldoADesobrigar','creditoPorRecebimentos','creditoPorLiquidacaoPrevia','creditoAConstituir','saldoAConservar','transferenciaCoberturaPendente']) = ((cabeca.snapshot->'memoria') - ARRAY['escolha','saldoADesobrigar','creditoPorRecebimentos','creditoPorLiquidacaoPrevia','creditoAConstituir','saldoAConservar','transferenciaCoberturaPendente']) THEN
   BEGIN PERFORM conferir_cobertura_futura_periodo_integral_67(cabeca); EXCEPTION WHEN raise_exception THEN cobertura_invalida:=true; END;
   IF NOT cobertura_invalida THEN RAISE EXCEPTION 'Aprovação vigente exige mudança de snapshot para nova revisão.'; END IF;
  END IF;
 END IF;
 IF length(trim(NEW.clausula)) NOT BETWEEN 5 AND 2000 OR length(trim(NEW."evidenciaEscolha")) NOT BETWEEN 5 AND 2000 OR length(trim(NEW.motivo)) NOT BETWEEN 5 AND 2000 OR length(trim(NEW."chaveIdempotencia")) NOT BETWEEN 8 AND 100 OR NEW."snapshotHash" !~ '^[a-f0-9]{64}$' OR NEW."entradaHash" !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Dados da proposta de período integral inválidos.'; END IF;
 PERFORM conferir_base_periodo_integral_67(NEW); PERFORM conferir_cobertura_futura_periodo_integral_67(NEW);
 RETURN NEW;
END $$;

