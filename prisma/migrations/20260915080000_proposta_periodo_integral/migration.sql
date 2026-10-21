-- FIN-02/Q67: decisão auditável para período integral sem oferta.
-- Esta etapa não cria crédito, não altera cobrança e não emite cobertura futura.
CREATE TABLE "PropostaPeriodoIntegral" (
  id TEXT NOT NULL,
  "matriculaId" TEXT NOT NULL,
  "cobrancaId" TEXT NOT NULL,
  "documentoId" TEXT NOT NULL,
  escolha TEXT NOT NULL,
  "coberturaFuturaInicio" DATE,
  "coberturaFuturaFim" DATE,
  clausula TEXT NOT NULL,
  "evidenciaEscolha" TEXT NOT NULL,
  motivo TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  "snapshotHash" TEXT NOT NULL,
  "autorId" TEXT NOT NULL,
  "chaveIdempotencia" TEXT NOT NULL,
  "entradaHash" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropostaPeriodoIntegral_pkey" PRIMARY KEY (id),
  CONSTRAINT "PropostaPeriodoIntegral_escolha_check" CHECK (escolha IN ('CREDITO', 'COBERTURA_FUTURA'))
);

CREATE TABLE "DecisaoPeriodoIntegral" (
  id TEXT NOT NULL,
  "propostaId" TEXT NOT NULL,
  "decisorId" TEXT NOT NULL,
  aprovada BOOLEAN NOT NULL,
  motivo TEXT NOT NULL,
  "entradaHash" TEXT NOT NULL,
  "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DecisaoPeriodoIntegral_pkey" PRIMARY KEY (id)
);

CREATE UNIQUE INDEX "PropPeriodoIntegral_autor_chave_key" ON "PropostaPeriodoIntegral"("autorId", "chaveIdempotencia");
CREATE INDEX "PropPeriodoIntegral_cobranca_idx" ON "PropostaPeriodoIntegral"("cobrancaId");
CREATE UNIQUE INDEX "DecPeriodoIntegral_proposta_key" ON "DecisaoPeriodoIntegral"("propostaId");

ALTER TABLE "PropostaPeriodoIntegral" ADD CONSTRAINT "PropPeriodoIntegral_matricula_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "PropostaPeriodoIntegral" ADD CONSTRAINT "PropPeriodoIntegral_cobranca_matricula_fkey" FOREIGN KEY ("cobrancaId", "matriculaId") REFERENCES "Cobranca"(id, "matriculaId") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "PropostaPeriodoIntegral" ADD CONSTRAINT "PropPeriodoIntegral_documento_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "PropostaPeriodoIntegral" ADD CONSTRAINT "PropPeriodoIntegral_autor_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoPeriodoIntegral" ADD CONSTRAINT "DecPeriodoIntegral_proposta_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaPeriodoIntegral"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoPeriodoIntegral" ADD CONSTRAINT "DecPeriodoIntegral_decisor_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION conferir_base_periodo_integral_67(p "PropostaPeriodoIntegral") RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  c "Cobranca"%ROWTYPE;
  m "Matricula"%ROWTYPE;
  d "Documento"%ROWTYPE;
  memoria JSONB;
  valores JSONB;
  saldo_reconciliado NUMERIC;
BEGIN
  SELECT * INTO m FROM "Matricula" WHERE id = p."matriculaId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Matrícula do período integral não encontrada.'; END IF;
  SELECT * INTO c FROM "Cobranca" WHERE id = p."cobrancaId";
  IF NOT FOUND OR c."matriculaId" IS DISTINCT FROM m.id THEN
    RAISE EXCEPTION 'Cobrança do período integral não pertence à matrícula.';
  END IF;
  SELECT * INTO d FROM "Documento" WHERE id = p."documentoId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento do período integral não encontrado.'; END IF;
  IF c.tipo <> 'MENSALIDADE' OR c."coberturaInicio" IS NULL OR c."coberturaFim" IS NULL
    OR c."coberturaFim" < c."coberturaInicio" OR c."coberturaInicio" < DATE '0001-01-01'
    OR c."coberturaFim" > DATE '9999-12-31' OR c."coberturaFim" - c."coberturaInicio" > 365 OR c."suspensaPorItemPausaId" IS NOT NULL
    OR c."canceladaPorPausaId" IS NOT NULL OR c.status = 'CANCELADA'
    OR EXISTS (SELECT 1 FROM "AjusteCobrancaAcerto" ajuste WHERE ajuste."cobrancaId" = c.id) THEN
    RAISE EXCEPTION 'Cobrança não possui cobertura mensal íntegra para o período integral.';
  END IF;
  IF m.status NOT IN ('ATIVA', 'PAUSADA') OR m.moeda IS DISTINCT FROM c.moeda
    OR m."contratoOk" IS DISTINCT FROM true OR m."confirmacaoContratoEm" IS NULL
    OR m."confirmacaoContratoPorId" IS NULL OR m."contratoDocumentoId" IS DISTINCT FROM d.id
    OR d.arquivado OR d.categoria <> 'CONTRATO'
    OR (d."matriculaId" = m.id OR (d."leadId" IS NOT NULL AND d."leadId" = m."leadId")) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Documento contratual confirmado não corresponde à matrícula.';
  END IF;
  IF EXISTS (SELECT 1 FROM "PagamentoInformado" i WHERE i."cobrancaId" = c.id AND i.status = 'A_CONFERIR') THEN
    RAISE EXCEPTION 'Informe de pagamento pendente impede decidir o período integral.';
  END IF;
  IF EXISTS (SELECT 1 FROM "DiaCompensacaoCobertura" dia WHERE dia."matriculaId" = m.id AND dia."diaOrigem" BETWEEN c."coberturaInicio" AND c."coberturaFim")
    OR EXISTS (SELECT 1 FROM "CompensacaoCoberturaMatricula" comp WHERE comp."cobrancaOrigemId" = c.id AND comp.status IN ('PENDENTE', 'APROVADA')) THEN
    RAISE EXCEPTION 'Compensação ou direito de cobertura existente impede decidir o período integral.';
  END IF;
  IF jsonb_typeof(p.snapshot) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Snapshot do período integral inválido.';
  END IF;
  memoria := p.snapshot->'memoria';
  valores := memoria->'valores';
  saldo_reconciliado := greatest(0, c."valorNegociado" - coalesce(c."valorRecebido", 0) - c."valorLiquidadoCredito");
  IF jsonb_typeof(memoria) IS DISTINCT FROM 'object' OR jsonb_typeof(valores) IS DISTINCT FROM 'object'
    OR p.snapshot->>'matriculaId' IS DISTINCT FROM m.id
    OR p.snapshot->>'cobrancaId' IS DISTINCT FROM c.id
    OR p.snapshot->>'documentoId' IS DISTINCT FROM d.id
    OR p.snapshot->>'cobrancaVersao' !~ '^(0|[1-9][0-9]*)$'
    OR (p.snapshot->>'cobrancaVersao')::integer IS DISTINCT FROM c.versao
    OR p.snapshot->>'statusMatricula' IS DISTINCT FROM m.status::text
    OR p.snapshot->>'contratoConfirmadoEm' IS DISTINCT FROM to_char(m."confirmacaoContratoEm", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    OR p.snapshot->>'contratoConfirmadoPorId' IS DISTINCT FROM m."confirmacaoContratoPorId"
    OR p.snapshot->>'statusCobranca' IS DISTINCT FROM c.status::text
    OR p.snapshot->>'vencimento' IS DISTINCT FROM to_char(c.vencimento, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    OR memoria->>'escolha' IS DISTINCT FROM p.escolha
    OR memoria#>>'{cobertura,inicio}' IS DISTINCT FROM to_char(c."coberturaInicio", 'YYYY-MM-DD')
    OR memoria#>>'{cobertura,fim}' IS DISTINCT FROM to_char(c."coberturaFim", 'YYYY-MM-DD')
    OR valores->>'valorOriginal' !~ '^-?[0-9]+(\.[0-9]{1,2})?$'
    OR valores->>'valorNegociado' !~ '^-?[0-9]+(\.[0-9]{1,2})?$'
    OR valores->>'valorRecebido' !~ '^-?[0-9]+(\.[0-9]{1,2})?$'
    OR valores->>'valorLiquidadoCredito' !~ '^-?[0-9]+(\.[0-9]{1,2})?$'
    OR valores->>'saldoReconciliado' !~ '^-?[0-9]+(\.[0-9]{1,2})?$'
    OR (valores->>'valorOriginal')::numeric IS DISTINCT FROM c."valorOriginal"
    OR (valores->>'valorNegociado')::numeric IS DISTINCT FROM c."valorNegociado"
    OR (valores->>'valorRecebido')::numeric IS DISTINCT FROM coalesce(c."valorRecebido", 0)
    OR (valores->>'valorLiquidadoCredito')::numeric IS DISTINCT FROM c."valorLiquidadoCredito"
    OR (valores->>'saldoReconciliado')::numeric IS DISTINCT FROM saldo_reconciliado
    OR memoria->>'moeda' IS DISTINCT FROM c.moeda
    OR jsonb_typeof(memoria->'diasConfirmados') IS DISTINCT FROM 'array'
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(memoria->'diasConfirmados') dia WHERE jsonb_typeof(dia) IS DISTINCT FROM 'string' OR dia #>> '{}' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
    OR EXISTS (
      SELECT 1 FROM generate_series(c."coberturaInicio", c."coberturaFim", INTERVAL '1 day') serie
      WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(memoria->'diasConfirmados') dia WHERE dia = to_char(serie::date, 'YYYY-MM-DD'))
    )
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(memoria->'diasConfirmados') dia
      WHERE dia::date < c."coberturaInicio" OR dia::date > c."coberturaFim"
    )
    OR EXISTS (
      SELECT dia FROM jsonb_array_elements_text(memoria->'diasConfirmados') dia
      GROUP BY dia HAVING count(*) > 1
    )
    OR (c.saldo IS NOT NULL AND c.saldo IS DISTINCT FROM saldo_reconciliado)
    OR (SELECT coalesce(sum(recebimento.valor), 0) FROM "Recebimento" recebimento WHERE recebimento."cobrancaId" = c.id) IS DISTINCT FROM coalesce(c."valorRecebido", 0)
    OR EXISTS (SELECT 1 FROM "Recebimento" recebimento WHERE recebimento."cobrancaId" = c.id AND recebimento.moeda IS DISTINCT FROM c.moeda)
    OR (SELECT coalesce(sum(uso.valor), 0) FROM "PropostaUsoCredito" uso JOIN "DecisaoUsoCredito" decisao_uso ON decisao_uso."propostaId" = uso.id AND decisao_uso.aprovada WHERE uso."cobrancaId" = c.id) IS DISTINCT FROM c."valorLiquidadoCredito" THEN
    RAISE EXCEPTION 'Snapshot aprovado diverge da cobrança, contrato ou cobertura atual.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM generate_series(c."coberturaInicio", c."coberturaFim", INTERVAL '1 day') serie
    WHERE NOT EXISTS (
      SELECT 1 FROM "RegistroIndisponibilidadeOfertaMatricula" relato
      JOIN "ConfirmacaoIndisponibilidadeOfertaMatricula" confirmacao
        ON confirmacao."registroId" = relato.id AND confirmacao.confirmada = true
      LEFT JOIN LATERAL (
        SELECT termino.fim FROM "PropostaTerminoIndisponibilidadeOferta" termino
        JOIN "DecisaoTerminoIndisponibilidadeOferta" decisao
          ON decisao."propostaId" = termino.id AND decisao.aprovada = true
        WHERE termino."registroId" = relato.id LIMIT 1
      ) termino ON true
      WHERE relato."matriculaId" = m.id AND relato.inicio <= serie::date
        AND COALESCE(relato.fim, termino.fim, DATE '9999-12-31') >= serie::date
    )
  ) THEN
    RAISE EXCEPTION 'Período integral exige indisponibilidade da oferta confirmada para toda a cobertura.';
  END IF;
END $$;

CREATE FUNCTION conferir_cobertura_futura_periodo_integral_67(p "PropostaPeriodoIntegral") RETURNS void LANGUAGE plpgsql AS $$
DECLARE c "Cobranca"%ROWTYPE;
BEGIN
  SELECT * INTO c FROM "Cobranca" WHERE id = p."cobrancaId" AND "matriculaId" = p."matriculaId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Cobrança do período integral não encontrada.'; END IF;
  IF p.escolha = 'CREDITO' THEN
    IF p."coberturaFuturaInicio" IS NOT NULL OR p."coberturaFuturaFim" IS NOT NULL THEN
      RAISE EXCEPTION 'Crédito não admite cobertura futura.';
    END IF;
    RETURN;
  END IF;
  IF p.escolha <> 'COBERTURA_FUTURA' OR p."coberturaFuturaInicio" IS NULL OR p."coberturaFuturaFim" IS NULL
    OR p."coberturaFuturaInicio" <= c."coberturaFim" OR p."coberturaFuturaFim" < p."coberturaFuturaInicio"
    OR p."coberturaFuturaInicio" < DATE '0001-01-01' OR p."coberturaFuturaFim" > DATE '9999-12-31'
    OR p."coberturaFuturaFim" - p."coberturaFuturaInicio" > 365 THEN
    RAISE EXCEPTION 'Cobertura futura do período integral é inválida.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Cobranca" outra
    WHERE outra."matriculaId" = p."matriculaId" AND outra.id <> c.id AND outra.tipo = 'MENSALIDADE'
      AND outra.status <> 'CANCELADA' AND outra."coberturaInicio" IS NOT NULL AND outra."coberturaFim" IS NOT NULL
      AND outra."coberturaInicio" <= p."coberturaFuturaFim" AND outra."coberturaFim" >= p."coberturaFuturaInicio"
  ) THEN RAISE EXCEPTION 'Cobertura futura sobrepõe outra mensalidade não cancelada.'; END IF;
  IF EXISTS (
    SELECT 1 FROM "DiaProgramadoRecomposicao" programacao
    JOIN "AplicacaoRecomposicaoCobertura" aplicacao ON aplicacao.id = programacao."aplicacaoId"
    JOIN "DecisaoRecomposicaoCobertura" decisao ON decisao.id = aplicacao."decisaoId"
    JOIN "RascunhoRecomposicaoCobertura" rascunho ON rascunho.id = decisao."rascunhoId"
    WHERE rascunho."matriculaId" = p."matriculaId" AND programacao."dataCobertura" BETWEEN p."coberturaFuturaInicio" AND p."coberturaFuturaFim"
  ) THEN RAISE EXCEPTION 'Cobertura futura sobrepõe dia já programado para recomposição.'; END IF;
  IF EXISTS (
    SELECT 1 FROM "RegistroIndisponibilidadeOfertaMatricula" relato
    LEFT JOIN "ConfirmacaoIndisponibilidadeOfertaMatricula" confirmacao ON confirmacao."registroId" = relato.id
    LEFT JOIN LATERAL (
      SELECT termino.fim FROM "PropostaTerminoIndisponibilidadeOferta" termino
      JOIN "DecisaoTerminoIndisponibilidadeOferta" decisao ON decisao."propostaId" = termino.id AND decisao.aprovada
      WHERE termino."registroId" = relato.id LIMIT 1
    ) termino ON true
    WHERE relato."matriculaId" = p."matriculaId" AND relato.inicio <= p."coberturaFuturaFim"
      AND COALESCE(relato.fim, termino.fim, DATE '9999-12-31') >= p."coberturaFuturaInicio"
      AND (confirmacao.confirmada = true OR confirmacao.id IS NULL)
  ) THEN RAISE EXCEPTION 'Cobertura futura possui relato de indisponibilidade que exige conferência.'; END IF;
END $$;

CREATE FUNCTION validar_proposta_periodo_integral() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE u "Usuario"%ROWTYPE; existente TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Propostas de período integral são preservadas.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  PERFORM id FROM "Matricula" WHERE id = NEW."matriculaId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Matrícula do período integral não encontrada.'; END IF;
  PERFORM id FROM "Cobranca" WHERE id = NEW."cobrancaId" AND "matriculaId" = NEW."matriculaId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cobrança do período integral não encontrada.'; END IF;
  PERFORM id FROM "Documento" WHERE id = NEW."documentoId" FOR SHARE;
  SELECT p.id INTO existente FROM "PropostaPeriodoIntegral" p LEFT JOIN "DecisaoPeriodoIntegral" d ON d."propostaId" = p.id WHERE p."cobrancaId" = NEW."cobrancaId" AND d.id IS NULL FOR SHARE OF p;
  SELECT * INTO u FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
  IF u.ativo IS DISTINCT FROM true OR NOT (u.papeis && ARRAY['FINANCEIRO','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Sem permissão para preparar período integral.'; END IF;
  IF existente IS NOT NULL THEN RAISE EXCEPTION 'Já existe proposta pendente para esta cobrança.'; END IF;
  IF EXISTS (SELECT 1 FROM "PropostaPeriodoIntegral" p JOIN "DecisaoPeriodoIntegral" d ON d."propostaId" = p.id WHERE p."cobrancaId" = NEW."cobrancaId" AND d.aprovada) THEN RAISE EXCEPTION 'Cobrança já possui período integral aprovado.'; END IF;
  IF length(trim(NEW.clausula)) NOT BETWEEN 5 AND 2000 OR length(trim(NEW."evidenciaEscolha")) NOT BETWEEN 5 AND 2000 OR length(trim(NEW.motivo)) NOT BETWEEN 5 AND 2000 OR length(trim(NEW."chaveIdempotencia")) NOT BETWEEN 8 AND 100 OR NEW."snapshotHash" !~ '^[a-f0-9]{64}$' OR NEW."entradaHash" !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Dados da proposta de período integral inválidos.'; END IF;
  PERFORM conferir_base_periodo_integral_67(NEW);
  PERFORM conferir_cobertura_futura_periodo_integral_67(NEW);
  RETURN NEW;
END $$;

CREATE TRIGGER validar_proposta_periodo_integral BEFORE INSERT OR UPDATE OR DELETE ON "PropostaPeriodoIntegral" FOR EACH ROW EXECUTE FUNCTION validar_proposta_periodo_integral();

CREATE FUNCTION validar_decisao_periodo_integral() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaPeriodoIntegral"%ROWTYPE; u "Usuario"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisões de período integral são preservadas.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  PERFORM m.id FROM "Matricula" m JOIN "PropostaPeriodoIntegral" p0 ON p0."matriculaId"=m.id WHERE p0.id=NEW."propostaId" FOR UPDATE OF m;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta do período integral não encontrada.'; END IF;
  PERFORM c.id FROM "Cobranca" c JOIN "PropostaPeriodoIntegral" p0 ON p0."cobrancaId"=c.id AND p0."matriculaId"=c."matriculaId" WHERE p0.id=NEW."propostaId" FOR UPDATE OF c;
  PERFORM d.id FROM "Documento" d JOIN "PropostaPeriodoIntegral" p0 ON p0."documentoId" = d.id WHERE p0.id=NEW."propostaId" FOR SHARE OF d;
  SELECT * INTO p FROM "PropostaPeriodoIntegral" WHERE id=NEW."propostaId" FOR UPDATE;
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."decisorId" FOR SHARE;
  IF u.ativo IS DISTINCT FROM true OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND 'financeiro.aprovar_acertos'=ANY(u.permissoes))) THEN RAISE EXCEPTION 'Sem permissão de aprovação financeira do período integral.'; END IF;
  IF NEW."decisorId" IS NOT DISTINCT FROM p."autorId" THEN RAISE EXCEPTION 'Outra pessoa deve decidir o período integral.'; END IF;
  IF length(trim(NEW.motivo)) NOT BETWEEN 5 AND 2000 OR NEW."entradaHash" !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Dados da decisão de período integral inválidos.'; END IF;
  IF NEW.aprovada THEN
    PERFORM conferir_base_periodo_integral_67(p);
    PERFORM conferir_cobertura_futura_periodo_integral_67(p);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER validar_decisao_periodo_integral BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoPeriodoIntegral" FOR EACH ROW EXECUTE FUNCTION validar_decisao_periodo_integral();
