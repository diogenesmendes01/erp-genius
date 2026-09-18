-- Corretiva de Q165.249: aliases SQL distintos de variáveis PL/pgSQL.
CREATE OR REPLACE FUNCTION q165_delta_efeitos_249(aplicacao_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  aplicacao "AplicacaoReconferenciaDeltaDesistencia"%ROWTYPE;
  proposta "PropostaReconferenciaDeltaDesistencia"%ROWTYPE;
  aplicacao_base "AplicacaoAcertoDesistenciaContratual"%ROWTYPE;
  proposta_base "PropostaAcertoDesistenciaContratual"%ROWTYPE;
  pedido "PedidoDesistenciaPreparacao"%ROWTYPE;
  item_memoria JSONB;
  fotografia_cobranca JSONB;
BEGIN
 SELECT * INTO aplicacao FROM "AplicacaoReconferenciaDeltaDesistencia" WHERE id=aplicacao_id FOR SHARE;
 SELECT * INTO proposta FROM "PropostaReconferenciaDeltaDesistencia" WHERE id=aplicacao."propostaId" FOR SHARE;
 SELECT * INTO aplicacao_base FROM "AplicacaoAcertoDesistenciaContratual" WHERE id=aplicacao."aplicacaoBaseId" FOR SHARE;
 SELECT proposta_q121.* INTO proposta_base FROM "PropostaAcertoDesistenciaContratual" proposta_q121 JOIN "DecisaoAcertoDesistenciaContratual" decisao_q121 ON decisao_q121."propostaId"=proposta_q121.id WHERE decisao_q121.id=aplicacao_base."decisaoId";
 SELECT * INTO pedido FROM "PedidoDesistenciaPreparacao" WHERE id=proposta_base."pedidoId" FOR SHARE;
 IF aplicacao.id IS NULL OR proposta.id IS NULL OR aplicacao_base.id IS NULL OR proposta_base.id IS NULL OR pedido.id IS NULL OR aplicacao."aplicacaoBaseId" IS DISTINCT FROM proposta."aplicacaoBaseId" OR aplicacao."aplicacaoDeltaAnteriorId" IS DISTINCT FROM proposta."aplicacaoDeltaAnteriorId" OR aplicacao."fotografiaHash" IS DISTINCT FROM proposta."fotografiaHash" OR aplicacao.fotografia IS DISTINCT FROM proposta.fotografia OR aplicacao."memoriaDelta" IS DISTINCT FROM proposta."memoriaDelta" OR NOT EXISTS(SELECT 1 FROM "DecisaoReconferenciaDeltaDesistencia" decisao_financeira WHERE decisao_financeira.id=aplicacao."decisaoFinanceiraId" AND decisao_financeira."propostaId"=proposta.id AND decisao_financeira.aprovada AND decisao_financeira."decisorId"=aplicacao."executorId") OR NOT EXISTS(SELECT 1 FROM "DecisaoAdministrativaReconferenciaDeltaDesistencia" decisao_administrativa WHERE decisao_administrativa."propostaId"=proposta.id AND decisao_administrativa.aprovada) THEN RAISE EXCEPTION 'Aplicação delta não corresponde às decisões e fotografia aprovadas'; END IF;
 IF EXISTS(SELECT 1 FROM "AplicacaoReconferenciaDeltaDesistencia" posterior WHERE posterior."aplicacaoDeltaAnteriorId"=aplicacao.id) THEN RAISE EXCEPTION 'A efetivação deve usar somente a última aplicação delta'; END IF;
 FOR item_memoria IN SELECT elemento FROM jsonb_array_elements(proposta."memoriaDelta"->'itens') AS elemento LOOP
   IF NOT EXISTS(SELECT 1 FROM "Cobranca" cobranca WHERE cobranca.id=item_memoria->>'cobrancaId' AND cobranca."matriculaId"=pedido."matriculaId" AND cobranca.moeda=item_memoria->>'moeda' AND cobranca."valorNegociado"=(item_memoria->>'devidoAlvo')::numeric AND coalesce(cobranca.saldo,0)=(item_memoria->>'saldoAlvo')::numeric) THEN RAISE EXCEPTION 'Cobrança não recebeu o efeito delta aprovado'; END IF;
   IF (item_memoria->>'creditoDelta')::numeric>0 THEN
     IF NOT EXISTS(SELECT 1 FROM "OrigemCreditoReconferenciaDeltaDesistencia" origem JOIN "CreditoMatricula" credito ON credito."origemReconferenciaDeltaDesistenciaId"=origem.id WHERE origem."aplicacaoId"=aplicacao.id AND origem."cobrancaId"=item_memoria->>'cobrancaId' AND origem.valor=(item_memoria->>'creditoDelta')::numeric AND origem.moeda=item_memoria->>'moeda' AND credito."matriculaId"=pedido."matriculaId" AND credito."valorInicial"=origem.valor AND credito.moeda=origem.moeda) THEN RAISE EXCEPTION 'Crédito delta não corresponde à origem por cobrança'; END IF;
   ELSIF EXISTS(SELECT 1 FROM "OrigemCreditoReconferenciaDeltaDesistencia" origem WHERE origem."aplicacaoId"=aplicacao.id AND origem."cobrancaId"=item_memoria->>'cobrancaId') THEN RAISE EXCEPTION 'Origem delta sem crédito aprovado'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM "OrigemCreditoReconferenciaDeltaDesistencia" WHERE "aplicacaoId"=aplicacao.id)<>(SELECT count(*) FROM jsonb_array_elements(proposta."memoriaDelta"->'itens') AS elemento WHERE (elemento->>'creditoDelta')::numeric>0) THEN RAISE EXCEPTION 'Origens delta não comprovam todos os efeitos'; END IF;
 FOR fotografia_cobranca IN SELECT elemento FROM jsonb_array_elements(proposta.fotografia->'cobrancas') AS elemento LOOP
   IF NOT EXISTS(SELECT 1 FROM "Cobranca" cobranca WHERE cobranca.id=fotografia_cobranca->>'id' AND cobranca."matriculaId"=pedido."matriculaId" AND cobranca.moeda=fotografia_cobranca->>'moeda' AND cobranca."valorOriginal"=(fotografia_cobranca->>'valorOriginal')::numeric AND cobranca."valorRecebido" IS NOT DISTINCT FROM (fotografia_cobranca->>'valorRecebido')::numeric AND cobranca."valorLiquidadoCredito"=(fotografia_cobranca->>'valorLiquidadoCredito')::numeric)
     OR jsonb_array_length(coalesce(fotografia_cobranca->'informes','[]'::jsonb))<>(SELECT count(*) FROM "PagamentoInformado" informe WHERE informe."cobrancaId"=fotografia_cobranca->>'id')
     OR jsonb_array_length(coalesce(fotografia_cobranca->'recebimentos','[]'::jsonb))<>(SELECT count(*) FROM "DestinacaoRecebimento" destinacao WHERE destinacao."cobrancaId"=fotografia_cobranca->>'id') THEN RAISE EXCEPTION 'Fonte financeira mudou depois da reconferência delta'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM "Cobranca" cobranca WHERE cobranca."matriculaId"=pedido."matriculaId" AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(proposta.fotografia->'cobrancas') AS elemento WHERE elemento->>'id'=cobranca.id)) OR EXISTS(SELECT 1 FROM "PagamentoInformado" informe JOIN "Cobranca" cobranca ON cobranca.id=informe."cobrancaId" WHERE cobranca."matriculaId"=pedido."matriculaId" AND informe.status='A_CONFERIR') OR EXISTS(SELECT 1 FROM "Cobranca" cobranca WHERE cobranca."matriculaId"=pedido."matriculaId" AND cobranca."valorCompensadoPermuta">0) THEN RAISE EXCEPTION 'Pendência ou fonte financeira posterior impede efetivação'; END IF;
END $$;
