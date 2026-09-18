-- Q165.253: revalida créditos, alçadas vigentes e reconhecimento completo na cadeia delta.
CREATE OR REPLACE FUNCTION q165_delta_integridade_253(aplicacao_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  aplicacao "AplicacaoReconferenciaDeltaDesistencia"%ROWTYPE;
  proposta "PropostaReconferenciaDeltaDesistencia"%ROWTYPE;
  aplicacao_base "AplicacaoAcertoDesistenciaContratual"%ROWTYPE;
  proposta_base "PropostaAcertoDesistenciaContratual"%ROWTYPE;
  pedido "PedidoDesistenciaPreparacao"%ROWTYPE;
BEGIN
  SELECT * INTO aplicacao FROM "AplicacaoReconferenciaDeltaDesistencia" WHERE id=aplicacao_id FOR SHARE;
  SELECT * INTO proposta FROM "PropostaReconferenciaDeltaDesistencia" WHERE id=aplicacao."propostaId" FOR SHARE;
  SELECT * INTO aplicacao_base FROM "AplicacaoAcertoDesistenciaContratual" WHERE id=aplicacao."aplicacaoBaseId" FOR SHARE;
  SELECT proposta_q121.* INTO proposta_base FROM "PropostaAcertoDesistenciaContratual" proposta_q121 JOIN "DecisaoAcertoDesistenciaContratual" decisao_q121 ON decisao_q121."propostaId"=proposta_q121.id WHERE decisao_q121.id=aplicacao_base."decisaoId";
  SELECT * INTO pedido FROM "PedidoDesistenciaPreparacao" WHERE id=proposta_base."pedidoId" FOR SHARE;
  IF aplicacao.id IS NULL OR proposta.id IS NULL OR aplicacao_base.id IS NULL OR proposta_base.id IS NULL OR pedido.id IS NULL THEN RAISE EXCEPTION 'Cadeia delta ausente para revalidar integridade'; END IF;

  IF NOT EXISTS(
    SELECT 1 FROM "DecisaoReconferenciaDeltaDesistencia" decisao JOIN "Usuario" usuario ON usuario.id=decisao."decisorId"
    WHERE decisao.id=aplicacao."decisaoFinanceiraId" AND decisao."propostaId"=proposta.id AND decisao.aprovada
      AND decisao."decisorId"<>proposta."preparadorId" AND usuario.ativo
      AND ('ADMINISTRADOR'=ANY(usuario.papeis) OR ('FINANCEIRO'=ANY(usuario.papeis) AND 'financeiro.aprovar_acertos'=ANY(usuario.permissoes)))
  ) OR NOT EXISTS(
    SELECT 1 FROM "DecisaoAdministrativaReconferenciaDeltaDesistencia" decisao JOIN "Usuario" usuario ON usuario.id=decisao."decisorId"
    WHERE decisao."propostaId"=proposta.id AND decisao.aprovada AND decisao."decisorId"<>proposta."preparadorId"
      AND usuario.ativo AND 'ADMINISTRADOR'=ANY(usuario.papeis)
  ) THEN RAISE EXCEPTION 'Decisões delta não possuem alçadas vigentes e independentes'; END IF;

  IF EXISTS(
    SELECT 1 FROM jsonb_array_elements(proposta.fotografia->'creditos') AS foto_credito
    WHERE NOT EXISTS(
      SELECT 1 FROM "CreditoMatricula" credito
      WHERE credito.id=foto_credito->>'id' AND credito."matriculaId"=pedido."matriculaId"
        AND credito.moeda=foto_credito->>'moeda' AND credito."valorInicial"=(foto_credito->>'valorInicial')::numeric
        AND credito."origemLiberacaoId" IS NOT DISTINCT FROM nullif(foto_credito->>'origemLiberacaoId','')
        AND credito."origemAcertoId" IS NOT DISTINCT FROM nullif(foto_credito->>'origemAcertoId','')
        AND credito."origemPeriodoIntegralId" IS NOT DISTINCT FROM nullif(foto_credito->>'origemPeriodoIntegralId','')
        AND credito."origemDestinacaoRecebimentoId" IS NOT DISTINCT FROM nullif(foto_credito->>'origemDestinacaoRecebimentoId','')
        AND credito."origemAcertoTaxaAditivoId" IS NOT DISTINCT FROM nullif(foto_credito->>'origemAcertoTaxaAditivoId','')
        AND credito."origemAcertoDesistenciaContratualId" IS NOT DISTINCT FROM nullif(foto_credito->>'origemAcertoDesistenciaContratualId','')
        AND credito."origemReconferenciaDeltaDesistenciaId" IS NOT DISTINCT FROM nullif(foto_credito->>'origemReconferenciaDeltaDesistenciaId','')
        AND (credito."valorInicial"-coalesce((SELECT sum(uso.valor) FROM "PropostaUsoCredito" uso JOIN "DecisaoUsoCredito" decisao_uso ON decisao_uso."propostaId"=uso.id AND decisao_uso.aprovada WHERE uso."creditoId"=credito.id),0)-coalesce((SELECT sum(reserva.valor) FROM "ReservaDevolucaoCredito" reserva WHERE reserva."creditoId"=credito.id AND reserva.estado<>'LIBERADA'),0))=(foto_credito->>'saldoDisponivel')::numeric
    )
  ) OR EXISTS(
    SELECT 1 FROM "CreditoMatricula" credito
    WHERE credito."matriculaId"=pedido."matriculaId"
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(proposta.fotografia->'creditos') AS foto_credito WHERE foto_credito->>'id'=credito.id)
      AND NOT EXISTS(
        SELECT 1 FROM "OrigemCreditoReconferenciaDeltaDesistencia" origem
        WHERE origem.id=credito."origemReconferenciaDeltaDesistenciaId" AND origem."aplicacaoId"=aplicacao.id
          AND credito."valorInicial"=origem.valor AND credito.moeda=origem.moeda
          AND (credito."valorInicial"-coalesce((SELECT sum(uso.valor) FROM "PropostaUsoCredito" uso JOIN "DecisaoUsoCredito" decisao_uso ON decisao_uso."propostaId"=uso.id AND decisao_uso.aprovada WHERE uso."creditoId"=credito.id),0)-coalesce((SELECT sum(reserva.valor) FROM "ReservaDevolucaoCredito" reserva WHERE reserva."creditoId"=credito.id AND reserva.estado<>'LIBERADA'),0))=credito."valorInicial"
      )
  ) THEN RAISE EXCEPTION 'Crédito, origem ou saldo disponível mudou desde a reconferência'; END IF;

  IF EXISTS(
    SELECT 1 FROM jsonb_array_elements(proposta.fotografia->'creditos') AS foto_credito
    JOIN "CreditoMatricula" credito ON credito.id=foto_credito->>'id'
    WHERE credito."origemAcertoDesistenciaContratualId" IS NULL AND credito."origemReconferenciaDeltaDesistenciaId" IS NULL
      AND (credito."valorInicial"-coalesce((SELECT sum(uso.valor) FROM "PropostaUsoCredito" uso JOIN "DecisaoUsoCredito" decisao_uso ON decisao_uso."propostaId"=uso.id AND decisao_uso.aprovada WHERE uso."creditoId"=credito.id),0)-coalesce((SELECT sum(reserva.valor) FROM "ReservaDevolucaoCredito" reserva WHERE reserva."creditoId"=credito.id AND reserva.estado<>'LIBERADA'),0))>0
      AND NOT EXISTS(
        SELECT 1 FROM "ReconhecimentoCreditoReconferenciaDeltaDesistencia" reconhecimento
        JOIN "AplicacaoReconferenciaDeltaDesistencia" aplicacao_reconhecida ON aplicacao_reconhecida.id=reconhecimento."aplicacaoId"
        WHERE reconhecimento."creditoId"=credito.id AND aplicacao_reconhecida."aplicacaoBaseId"=aplicacao."aplicacaoBaseId"
      )
  ) THEN RAISE EXCEPTION 'Crédito externo positivo exige reconhecimento auditável na cadeia delta'; END IF;
END $$;

CREATE OR REPLACE FUNCTION q165_delta_integridade_trigger_253() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
  PERFORM q165_delta_integridade_253(NEW.id);
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER q165_delta_integridade_253
AFTER INSERT ON "AplicacaoReconferenciaDeltaDesistencia" DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION q165_delta_integridade_trigger_253();

CREATE OR REPLACE FUNCTION q165_validar_efeitos_aplicacao(aplicacao_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE ultima TEXT;
BEGIN
  SELECT aplicacao_delta.id INTO ultima FROM "AplicacaoReconferenciaDeltaDesistencia" aplicacao_delta
  WHERE aplicacao_delta."aplicacaoBaseId"=aplicacao_id ORDER BY aplicacao_delta."criadaEm" DESC,aplicacao_delta.id DESC LIMIT 1;
  IF ultima IS NULL THEN
    PERFORM q165_validar_efeitos_base_249(aplicacao_id);
  ELSE
    PERFORM q165_delta_efeitos_249(ultima);
    PERFORM q165_delta_integridade_253(ultima);
  END IF;
END $$;

