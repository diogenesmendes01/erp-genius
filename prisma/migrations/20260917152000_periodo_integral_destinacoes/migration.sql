-- 227: conferir os valores destinados à cobrança, preservando o recebimento original Q87.
CREATE OR REPLACE FUNCTION conferir_base_periodo_integral_67(p "PropostaPeriodoIntegral") RETURNS void LANGUAGE plpgsql AS $$
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
    OR (SELECT coalesce(sum(destinacao.valor), 0) FROM "DestinacaoRecebimento" destinacao WHERE destinacao."cobrancaId" = c.id) IS DISTINCT FROM coalesce(c."valorRecebido", 0)
    OR EXISTS (SELECT 1 FROM "DestinacaoRecebimento" destinacao JOIN "Recebimento" recebimento ON recebimento.id = destinacao."recebimentoId" WHERE destinacao."cobrancaId" = c.id AND recebimento.moeda IS DISTINCT FROM c.moeda)
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

