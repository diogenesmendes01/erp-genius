-- Q117 corretiva: a aplicação não pode anunciar como operacional um preço em
-- moeda ou regime que os resolvedores financeiros ainda recusariam.
CREATE FUNCTION validar_compatibilidade_aplicacao_aditivo_117() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v "VersaoCondicoesAditivo"%ROWTYPE; p "PropostaAditivoContratual"%ROWTYPE; m "Matricula"%ROWTYPE; preparacao "PreparacaoComercialMatricula"%ROWTYPE;
        conclusao "ConclusaoAssinaturaContratual"%ROWTYPE; processo "ProcessoAssinaturaContratual"%ROWTYPE; artefato "ArtefatoContratual"%ROWTYPE; previa "PreviaDocumentoContratual"%ROWTYPE; regime_original TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO v FROM "VersaoCondicoesAditivo" WHERE id = NEW."versaoCondicoesId" FOR SHARE;
  SELECT * INTO p FROM "PropostaAditivoContratual" WHERE id = v."propostaId" FOR SHARE;
  SELECT * INTO m FROM "Matricula" WHERE id = v."matriculaId" FOR UPDATE;
  SELECT * INTO preparacao FROM "PreparacaoComercialMatricula" WHERE "matriculaId" = m.id FOR SHARE;
  SELECT * INTO conclusao FROM "ConclusaoAssinaturaContratual" WHERE id = p."conclusaoOriginalId" FOR SHARE;
  SELECT * INTO processo FROM "ProcessoAssinaturaContratual" WHERE id = conclusao."processoId" FOR UPDATE;
  SELECT * INTO artefato FROM "ArtefatoContratual" WHERE id = processo."artefatoId" FOR SHARE;
  SELECT * INTO previa FROM "PreviaDocumentoContratual" WHERE id = artefato."previaId" FOR SHARE;
  regime_original := previa.snapshot->'condicoes'->'aulas'->>'regime';
  IF regime_original IS NULL OR regime_original NOT IN ('MENSALIDADE','HORA_PARTICULAR') THEN RAISE EXCEPTION 'Regime do contrato assinado exige conferência'; END IF;
  IF preparacao.id IS NOT NULL AND preparacao.regime::text IS DISTINCT FROM regime_original THEN RAISE EXCEPTION 'Preparação comercial diverge do contrato assinado'; END IF;
  IF v.condicoes ? 'MENSALIDADE_VALOR' AND (
    jsonb_typeof(v.condicoes->'MENSALIDADE_VALOR') IS DISTINCT FROM 'object'
    OR v.condicoes->'MENSALIDADE_VALOR'->>'tipo' IS DISTINCT FROM 'DINHEIRO'
    OR v.condicoes->'MENSALIDADE_VALOR'->>'moeda' IS DISTINCT FROM m.moeda
    OR regime_original IS DISTINCT FROM 'MENSALIDADE'
  ) THEN RAISE EXCEPTION 'Valor mensal incompatível com moeda ou regime atual'; END IF;
  IF v.condicoes ? 'HORA_VALOR' AND (
    jsonb_typeof(v.condicoes->'HORA_VALOR') IS DISTINCT FROM 'object'
    OR v.condicoes->'HORA_VALOR'->>'tipo' IS DISTINCT FROM 'DINHEIRO'
    OR v.condicoes->'HORA_VALOR'->>'moeda' IS DISTINCT FROM m.moeda
    OR regime_original IS DISTINCT FROM 'HORA_PARTICULAR'
  ) THEN RAISE EXCEPTION 'Valor por hora incompatível com moeda ou regime atual'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validar_compatibilidade_aplicacao_aditivo_117
BEFORE INSERT ON "AplicacaoCondicoesAditivo"
FOR EACH ROW EXECUTE FUNCTION validar_compatibilidade_aplicacao_aditivo_117();
