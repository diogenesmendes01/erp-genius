-- 216: proposta pendente exige decisão registrada; obsolescência aprovada usa a invalidação material de 213.
BEGIN;
CREATE OR REPLACE FUNCTION "dct03_acerto_taxa_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaAcertoTaxaAditivo"%ROWTYPE; pa "PropostaAditivoContratual"%ROWTYPE; c "Cobranca"%ROWTYPE; d "DecisaoAcertoTaxaAditivo"%ROWTYPE; v "VersaoCondicoesAditivo"%ROWTYPE; u "Usuario"%ROWTYPE; credito_anterior NUMERIC; credito_total NUMERIC;
BEGIN
  IF TG_TABLE_NAME = 'PropostaAcertoTaxaAditivo' THEN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Proposta de acerto de taxa é imutável'; END IF;
    IF TG_OP = 'UPDATE' THEN
      IF (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') THEN RAISE EXCEPTION 'Fotografia e valores do acerto são imutáveis'; END IF;
      IF OLD.status='PENDENTE' AND NEW.status='REJEITADA' AND EXISTS (SELECT 1 FROM "DecisaoAcertoTaxaAditivo" x WHERE x."propostaId"=NEW.id AND NOT x.aprovada AND x."fotografiaHash"=NEW."fotografiaHash") THEN RETURN NEW; END IF;
      IF OLD.status='PENDENTE' AND NEW.status='APROVADA' AND EXISTS (SELECT 1 FROM "DecisaoAcertoTaxaAditivo" x WHERE x."propostaId"=NEW.id AND x.aprovada AND x."fotografiaHash"=NEW."fotografiaHash") THEN RETURN NEW; END IF;
      IF OLD.status='APROVADA' AND NEW.status='APLICADA' AND EXISTS (SELECT 1 FROM "AplicacaoAcertoTaxaAditivo" x WHERE x."propostaId"=NEW.id) THEN RETURN NEW; END IF;
      IF OLD.status='APROVADA' AND NEW.status='OBSOLETA' AND EXISTS (SELECT 1 FROM "InvalidacaoAcertoTaxaAditivo" x WHERE x."propostaId"=NEW.id AND x."fotografiaOriginalHash"=OLD."fotografiaHash") THEN RETURN NEW; END IF;
      RAISE EXCEPTION 'Transição de estado não corresponde à decisão ou aplicação';
    END IF;
    SELECT * INTO u FROM "Usuario" WHERE id=NEW."preparadorId" FOR SHARE;
    SELECT * INTO c FROM "Cobranca" WHERE id=NEW."cobrancaId" FOR SHARE;
    SELECT * INTO v FROM "VersaoCondicoesAditivo" WHERE id=NEW."versaoCondicoesId" FOR SHARE;
    SELECT * INTO pa FROM "PropostaAditivoContratual" WHERE id=NEW."propostaAditivoId" FOR SHARE;
    IF u.id IS NULL OR NOT u.ativo OR NOT ('FINANCEIRO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis)) THEN RAISE EXCEPTION 'Proposta exige Financeiro ativo'; END IF;
    IF c.id IS NULL OR c."matriculaId" IS DISTINCT FROM NEW."matriculaId" OR c.tipo <> 'MATRICULA' THEN RAISE EXCEPTION 'Acerto exige cobrança real de taxa da mesma matrícula'; END IF;
    IF v.id IS NULL OR v."matriculaId" IS DISTINCT FROM NEW."matriculaId" OR v."propostaId" IS DISTINCT FROM NEW."propostaAditivoId" OR v."conferenciaFinalId" IS DISTINCT FROM NEW."conferenciaFinalId" OR NOT (v.condicoes ?| ARRAY['TAXA_VALOR','TAXA_VENCIMENTO']) THEN RAISE EXCEPTION 'A versão formalizada não contém alteração de taxa verificável'; END IF;
    IF pa.id IS NULL OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(pa.snapshot->'entrada'->'alteracoes') a WHERE a->>'origem' IN ('TAXA_VALOR','TAXA_VENCIMENTO')) THEN RAISE EXCEPTION 'A taxa herdada de outra versão não pode gerar acerto neste aditivo'; END IF;
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
    credito_total := greatest(0,coalesce(c."valorRecebido",0)+c."valorLiquidadoCredito"-NEW."valorNovo");
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
  SELECT * INTO v FROM "VersaoCondicoesAditivo" WHERE id=p."versaoCondicoesId" FOR SHARE;
  IF p.id IS NULL OR d.id IS NULL OR c.id IS NULL OR v.id IS NULL OR u.id IS NULL OR NOT u.ativo OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND 'financeiro.aprovar_acertos'=ANY(u.permissoes))) OR NEW."executorId" IS DISTINCT FROM d."decisorId" OR d."propostaId" IS DISTINCT FROM p.id OR NOT d.aprovada OR p.status <> 'APROVADA' OR v."vigenciaInicio" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') OR EXISTS (SELECT 1 FROM "VersaoCondicoesAditivo" posterior WHERE posterior."matriculaId"=v."matriculaId" AND posterior.versao>v.versao) OR c.id IS DISTINCT FROM p."cobrancaId" OR c.versao IS DISTINCT FROM NEW."versaoAnterior" OR NEW."versaoAnterior" IS DISTINCT FROM (p.fotografia->'cobranca'->>'versao')::integer OR c."valorNegociado" IS DISTINCT FROM NEW."valorAnterior" OR c.vencimento::date IS DISTINCT FROM NEW."vencimentoAnterior" OR NEW."valorNovo" IS DISTINCT FROM p."valorNovo" OR NEW."vencimentoNovo" IS DISTINCT FROM p."vencimentoNovo" OR NEW."creditoAnterior" IS DISTINCT FROM p."creditoAnterior" OR NEW."creditoNovo" IS DISTINCT FROM p."creditoNovo" OR c.tipo <> 'MATRICULA' THEN RAISE EXCEPTION 'Aplicação exige executor financeiro ativo, vigência atual e versão não obsoleta'; END IF;
  RETURN NEW;
END $$;
COMMIT;
