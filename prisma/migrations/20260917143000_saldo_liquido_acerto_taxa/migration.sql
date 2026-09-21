-- DCT03/218: crédito de taxa já entregue continua sendo um direito do aluno.
-- As migrações 212--217 permanecem imutáveis; esta migração substitui apenas
-- funções de triggers já existentes, sem obter definições do banco em execução.
BEGIN;

CREATE OR REPLACE FUNCTION "dct03_saldo_liquido_taxa_218"(cobranca_id text, valor_novo numeric)
RETURNS numeric LANGUAGE sql STABLE AS $$
 SELECT greatest(0, valor_novo-coalesce(c."valorRecebido",0)-c."valorLiquidadoCredito"+coalesce((SELECT sum(o.valor) FROM "OrigemCreditoAcertoTaxaAditivo" o WHERE o."cobrancaId"=c.id),0)) FROM "Cobranca" c WHERE c.id=cobranca_id
$$;

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
    IF ((v.condicoes ? 'TAXA_VALOR' AND ((v.condicoes->'TAXA_VALOR'->>'tipo') IS DISTINCT FROM 'DINHEIRO' OR (v.condicoes->'TAXA_VALOR'->>'moeda') IS DISTINCT FROM c.moeda OR (v.condicoes->'TAXA_VALOR'->>'valor')::numeric IS DISTINCT FROM NEW."valorNovo")) OR (NOT (v.condicoes ? 'TAXA_VALOR') AND c."valorNegociado" IS DISTINCT FROM NEW."valorNovo") OR (v.condicoes ? 'TAXA_VENCIMENTO' AND ((v.condicoes->'TAXA_VENCIMENTO'->>'tipo') IS DISTINCT FROM 'DATA' OR (v.condicoes->'TAXA_VENCIMENTO'->>'data')::date IS DISTINCT FROM NEW."vencimentoNovo")) OR (NOT (v.condicoes ? 'TAXA_VENCIMENTO') AND c.vencimento::date IS DISTINCT FROM NEW."vencimentoNovo")) THEN RAISE EXCEPTION 'Valor ou vencimento não corresponde às condições formalizadas'; END IF;
    SELECT coalesce(sum(o.valor),0) INTO credito_anterior FROM "OrigemCreditoAcertoTaxaAditivo" o WHERE o."cobrancaId"=c.id;
    credito_total := greatest(0,coalesce(c."valorRecebido",0)+c."valorLiquidadoCredito"-NEW."valorNovo");
    IF NEW."creditoAnterior" IS DISTINCT FROM credito_anterior THEN RAISE EXCEPTION 'Crédito anterior não corresponde ao acerto'; END IF;
    IF NEW."creditoNovo" IS DISTINCT FROM greatest(0,credito_total-credito_anterior) THEN RAISE EXCEPTION 'Crédito novo não corresponde ao excedente ainda não originado'; END IF;
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

CREATE OR REPLACE FUNCTION "dct03_conferir_aplicacao_taxa_final"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a "AplicacaoAcertoTaxaAditivo"%ROWTYPE; p "PropostaAcertoTaxaAditivo"%ROWTYPE; c "Cobranca"%ROWTYPE; esperado_saldo NUMERIC; credito_total NUMERIC;
BEGIN
  SELECT * INTO a FROM "AplicacaoAcertoTaxaAditivo" WHERE id=NEW.id FOR SHARE;
  SELECT * INTO p FROM "PropostaAcertoTaxaAditivo" WHERE id=a."propostaId" FOR SHARE;
  SELECT * INTO c FROM "Cobranca" WHERE id=a."cobrancaId" FOR SHARE;
  SELECT coalesce(sum(o.valor),0) INTO credito_total FROM "OrigemCreditoAcertoTaxaAditivo" o WHERE o."cobrancaId"=a."cobrancaId";
  esperado_saldo := greatest(0,a."valorNovo"-coalesce(c."valorRecebido",0)-c."valorLiquidadoCredito"+credito_total);
  IF p.status <> 'APLICADA' OR c."valorNegociado" IS DISTINCT FROM a."valorNovo" OR c.vencimento::date IS DISTINCT FROM a."vencimentoNovo" OR c.saldo IS DISTINCT FROM esperado_saldo OR credito_total IS DISTINCT FROM a."creditoAnterior"+a."creditoNovo" OR (a."creditoNovo">0 AND NOT EXISTS (SELECT 1 FROM "OrigemCreditoAcertoTaxaAditivo" o JOIN "CreditoMatricula" cr ON cr."origemAcertoTaxaAditivoId"=o.id WHERE o."aplicacaoId"=a.id AND o.valor=a."creditoNovo")) OR (a."creditoNovo"=0 AND EXISTS (SELECT 1 FROM "OrigemCreditoAcertoTaxaAditivo" o WHERE o."aplicacaoId"=a.id)) THEN RAISE EXCEPTION 'Aplicação de taxa não preserva o saldo ou crédito incremental aprovado'; END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION "proteger_saldo_credito_cobranca"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE total_credito numeric; total_recebido numeric; credito_taxa numeric; saldo_esperado numeric;
BEGIN
  SELECT coalesce(sum(p.valor), 0) INTO total_credito FROM "PropostaUsoCredito" p JOIN "DecisaoUsoCredito" d ON d."propostaId" = p.id AND d.aprovada WHERE p."cobrancaId" = NEW.id;
  SELECT coalesce(sum(dest.valor), 0) INTO total_recebido FROM "DestinacaoRecebimento" dest WHERE dest."cobrancaId" = NEW.id;
  SELECT coalesce(sum(o.valor), 0) INTO credito_taxa FROM "OrigemCreditoAcertoTaxaAditivo" o WHERE o."cobrancaId" = NEW.id;
  saldo_esperado := greatest(0, NEW."valorNegociado" - total_recebido - total_credito + credito_taxa);
  IF NEW."valorLiquidadoCredito" IS DISTINCT FROM total_credito OR coalesce(NEW."valorRecebido", 0) IS DISTINCT FROM total_recebido OR (NEW.saldo IS NOT NULL AND NEW.saldo IS DISTINCT FROM saldo_esperado) OR (NEW.status = 'PAGO' AND saldo_esperado <> 0) THEN RAISE EXCEPTION 'Cobrança deve refletir somente destinações e créditos aprovados.'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "conferir_decisao_uso_credito"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaUsoCredito"; credito "CreditoMatricula"; c "Cobranca"; autorizado boolean; credito_taxa numeric;
BEGIN
 SELECT * INTO p FROM "PropostaUsoCredito" WHERE id = NEW."propostaId" FOR SHARE;
 SELECT ativo AND ('ADMINISTRADOR' = ANY(papeis) OR ('FINANCEIRO' = ANY(papeis) AND 'financeiro.aprovar_acertos' = ANY(permissoes))) INTO autorizado FROM "Usuario" WHERE id = NEW."decisorId" FOR SHARE;
 IF autorizado IS DISTINCT FROM true OR p."preparadorId" = NEW."decisorId" THEN RAISE EXCEPTION 'Utilização exige aprovação financeira independente'; END IF;
 IF NEW.aprovada THEN
  SELECT * INTO credito FROM "CreditoMatricula" WHERE id = p."creditoId" FOR UPDATE;
  SELECT * INTO c FROM "Cobranca" WHERE id = p."cobrancaId" FOR UPDATE;
  SELECT coalesce(sum(o.valor),0) INTO credito_taxa FROM "OrigemCreditoAcertoTaxaAditivo" o WHERE o."cobrancaId" = c.id;
  IF EXISTS(SELECT 1 FROM "PropostaUsoCredito" WHERE "creditoId"=credito.id AND versao>p.versao) OR saldo_credito_disponivel_207(credito.id)<p.valor OR credito."matriculaId" IS DISTINCT FROM c."matriculaId" OR credito.moeda IS DISTINCT FROM c.moeda OR c.status NOT IN ('PENDENTE','ATRASADO') OR p.valor>c."valorNegociado"-coalesce(c."valorRecebido",0)-c."valorLiquidadoCredito"+credito_taxa OR c."suspensaPorItemPausaId" IS NOT NULL OR c."canceladaPorPausaId" IS NOT NULL OR EXISTS(SELECT 1 FROM "PagamentoInformado" WHERE "cobrancaId"=c.id AND status='A_CONFERIR') THEN RAISE EXCEPTION 'Utilização incompatível com versão, saldo, matrícula ou cobrança'; END IF;
  IF (p.snapshot->>'cobrancaVersao')::integer IS DISTINCT FROM c.versao OR (p.snapshot->>'valorCredito')::numeric IS DISTINCT FROM saldo_credito_disponivel_207(credito.id) THEN RAISE EXCEPTION 'Confira novamente a proposta de crédito'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "aplicar_uso_credito"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaUsoCredito"; c "Cobranca"; novo_total numeric; credito_taxa numeric; restante numeric;
BEGIN
 IF NEW.aprovada THEN
  SELECT * INTO p FROM "PropostaUsoCredito" WHERE id = NEW."propostaId";
  SELECT * INTO c FROM "Cobranca" WHERE id = p."cobrancaId" FOR UPDATE;
  SELECT coalesce(sum(pp.valor),0) INTO novo_total FROM "PropostaUsoCredito" pp JOIN "DecisaoUsoCredito" dd ON dd."propostaId" = pp.id AND dd.aprovada WHERE pp."cobrancaId" = c.id;
  SELECT coalesce(sum(o.valor),0) INTO credito_taxa FROM "OrigemCreditoAcertoTaxaAditivo" o WHERE o."cobrancaId" = c.id;
  restante := greatest(0, c."valorNegociado" - coalesce(c."valorRecebido",0) - novo_total + credito_taxa);
  UPDATE "Cobranca" SET "valorLiquidadoCredito" = novo_total, saldo = restante, versao = versao + 1,
   status = CASE WHEN restante = 0 THEN 'PAGO'::"StatusCobranca" WHEN vencimento < CURRENT_TIMESTAMP THEN 'ATRASADO'::"StatusCobranca" ELSE 'PENDENTE'::"StatusCobranca" END,
   "pagoEm" = CASE WHEN restante = 0 THEN NEW."decididaEm" ELSE NULL END WHERE id = c.id;
 END IF;
 RETURN NEW;
END $$;
COMMIT;
