-- 240: vínculo ao intervalo assinado e consistência temporal do conjunto Q168/Q169.
BEGIN;
CREATE FUNCTION conferir_intervalos_cobertura_240(conjunto_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE inicio_assinado DATE; fim_assinado DATE;
BEGIN
 PERFORM conferir_linhas_conjunto_cobertura_238(conjunto_id);
 SELECT (a->'valorEstruturado'->>'data')::date INTO inicio_assinado
 FROM "ConjuntoImpactosCoberturaAditivo" c JOIN "PropostaAditivoContratual" p ON p.id=c."propostaAditivoId",
 LATERAL jsonb_array_elements(p.snapshot->'entrada'->'alteracoes') a
 WHERE c.id=conjunto_id AND a->>'origem'='COBERTURA_INICIO' AND a->'valorEstruturado'->>'tipo'='DATA';
 SELECT (a->'valorEstruturado'->>'data')::date INTO fim_assinado
 FROM "ConjuntoImpactosCoberturaAditivo" c JOIN "PropostaAditivoContratual" p ON p.id=c."propostaAditivoId",
 LATERAL jsonb_array_elements(p.snapshot->'entrada'->'alteracoes') a
 WHERE c.id=conjunto_id AND a->>'origem'='COBERTURA_FIM' AND a->'valorEstruturado'->>'tipo'='DATA';
 IF inicio_assinado IS NULL OR fim_assinado IS NULL OR inicio_assinado>fim_assinado OR NOT EXISTS(
   SELECT 1 FROM "ImpactoCoberturaAditivo" i WHERE i."conjuntoId"=conjunto_id AND i.classificacao='AFETADA'
   AND i."coberturaInicioNova"=inicio_assinado AND i."coberturaFimNova"=fim_assinado
 ) THEN RAISE EXCEPTION 'Conjunto não aplica o intervalo formalizado no aditivo assinado'; END IF;
 IF EXISTS(
   WITH linhas AS (SELECT id,classificacao,
    CASE WHEN classificacao='AFETADA' THEN "coberturaInicioNova" ELSE "coberturaInicioAnterior" END inicio,
    CASE WHEN classificacao='AFETADA' THEN "coberturaFimNova" ELSE "coberturaFimAnterior" END fim
    FROM "ImpactoCoberturaAditivo" WHERE "conjuntoId"=conjunto_id)
   SELECT 1 FROM linhas a JOIN linhas b ON a.id<b.id AND a.inicio<=b.fim AND b.inicio<=a.fim
   WHERE a.classificacao='AFETADA' OR b.classificacao='AFETADA'
 ) THEN RAISE EXCEPTION 'Sobreposição de intervalos de cobertura no conjunto'; END IF;
 IF EXISTS(
   WITH linhas AS (SELECT id,classificacao,"coberturaInicioAnterior" inicio_ant,"coberturaFimAnterior" fim_ant,
    CASE WHEN classificacao='AFETADA' THEN "coberturaInicioNova" ELSE "coberturaInicioAnterior" END inicio,
    CASE WHEN classificacao='AFETADA' THEN "coberturaFimNova" ELSE "coberturaFimAnterior" END fim
    FROM "ImpactoCoberturaAditivo" WHERE "conjuntoId"=conjunto_id),
   ordenadas AS (SELECT *,lag(fim) OVER w anterior_fim,lag(fim_ant) OVER w anterior_fim_ant,
     lag(classificacao) OVER w anterior_classificacao FROM linhas WHERE inicio IS NOT NULL AND fim IS NOT NULL WINDOW w AS (ORDER BY inicio,id))
   SELECT 1 FROM ordenadas WHERE anterior_fim+1<inicio AND (classificacao='AFETADA' OR anterior_classificacao='AFETADA')
   AND (anterior_fim_ant IS DISTINCT FROM anterior_fim OR inicio_ant IS DISTINCT FROM inicio)
 ) THEN RAISE EXCEPTION 'Lacuna nova entre intervalos de cobertura no conjunto'; END IF;
END $$;
CREATE FUNCTION proteger_intervalos_cobertura_240() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='ImpactoCoberturaAditivo' THEN
   PERFORM conferir_intervalos_cobertura_240(NEW."conjuntoId");
 ELSE
   PERFORM conferir_intervalos_cobertura_240(NEW.id);
 END IF;
 RETURN NEW;
END $$;
-- Diferido: todos os impactos do preparo atômico já existem antes da conferência.
CREATE CONSTRAINT TRIGGER "ImpactoCoberturaAditivo_intervalos_240" AFTER INSERT ON "ImpactoCoberturaAditivo"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION proteger_intervalos_cobertura_240();
CREATE TRIGGER "ConjuntoImpactosCoberturaAditivo_intervalos_240" BEFORE UPDATE OF status ON "ConjuntoImpactosCoberturaAditivo"
 FOR EACH ROW WHEN (NEW.status IN ('APROVADO','COMPLETO')) EXECUTE FUNCTION proteger_intervalos_cobertura_240();
COMMIT;
