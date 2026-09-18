-- Q244: corrige a seleção do plano Q165 e conserva a prova financeira entre
-- a aplicação e a efetivação Q121.
BEGIN;

CREATE OR REPLACE FUNCTION "impedir_decisao_desistencia_com_destinacao_fin04_211"()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pedido RECORD; plano_id TEXT;
BEGIN
  IF TG_OP='INSERT' AND NEW.aprovada THEN
    SELECT * INTO pedido FROM "PedidoDesistenciaPreparacao" WHERE id=NEW."pedidoId" FOR SHARE;
    IF EXISTS (SELECT 1 FROM "DestinacaoRecebimento" d JOIN "Cobranca" c ON c.id=d."cobrancaId" WHERE c."matriculaId"=pedido."matriculaId") THEN
      SELECT proposta.id INTO plano_id
      FROM "PropostaAcertoDesistenciaContratual" proposta
      JOIN "DecisaoAcertoDesistenciaContratual" decisao ON decisao."propostaId"=proposta.id
      WHERE proposta."pedidoId"=pedido.id AND decisao.aprovada
      ORDER BY proposta."criadaEm" DESC, proposta.id DESC
      LIMIT 1 FOR SHARE;
      IF plano_id IS NULL THEN
        RAISE EXCEPTION 'Aprovação administrativa exige plano Q165 aprovado para a destinação de recebimento.';
      END IF;
      PERFORM q165_fotografia_atual(plano_id);
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION q165_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE p "PropostaAcertoDesistenciaContratual"%ROWTYPE; d "DecisaoAcertoDesistenciaContratual"%ROWTYPE; regras JSONB;
BEGIN
 IF TG_TABLE_NAME='PropostaAcertoDesistenciaContratual' THEN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Proposta é imutável'; END IF;
  SELECT c.regras INTO regras FROM "CondicoesEncerramentoMatricula" c WHERE c.id=NEW."condicoesId" FOR SHARE;
  IF NEW."condicoesHash" IS DISTINCT FROM encode(digest(q165_json_canon(regras),'sha256'),'hex') OR NEW."fotografiaHash" IS DISTINCT FROM encode(digest(q165_json_canon(NEW.memoria->'fotografia'),'sha256'),'hex') THEN RAISE EXCEPTION 'Hashes Q165 não comprovam a memória canônica'; END IF;
  PERFORM q165_autorizado(NEW."preparadorId",false);
  PERFORM q165_contexto(NEW.id);
  IF EXISTS (
    SELECT 1 FROM "AplicacaoAcertoDesistenciaContratual" aplicacao
    JOIN "DecisaoAcertoDesistenciaContratual" decisao ON decisao.id=aplicacao."decisaoId"
    JOIN "PropostaAcertoDesistenciaContratual" anterior ON anterior.id=decisao."propostaId"
    WHERE anterior."pedidoId"=NEW."pedidoId"
  ) THEN RAISE EXCEPTION 'Este pedido já possui aplicação Q165 pendente de efetivação.'; END IF;
  PERFORM q165_memoria(NEW.id);
  RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='DecisaoAcertoDesistenciaContratual' THEN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Decisão é imutável'; END IF;
  SELECT * INTO p FROM "PropostaAcertoDesistenciaContratual" WHERE id=NEW."propostaId" FOR UPDATE;
  IF p.id IS NULL OR p."preparadorId"=NEW."decisorId" OR NEW."condicoesHash" IS DISTINCT FROM p."condicoesHash" OR NEW."fotografiaHash" IS DISTINCT FROM p."fotografiaHash" THEN RAISE EXCEPTION 'Decisão não corresponde à proposta independente'; END IF;
  PERFORM q165_autorizado(NEW."decisorId",true); IF NEW.aprovada THEN PERFORM q165_contexto(p.id); PERFORM q165_memoria(p.id); END IF; RETURN NEW;
 END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Aplicação é imutável'; END IF;
 SELECT * INTO d FROM "DecisaoAcertoDesistenciaContratual" WHERE id=NEW."decisaoId" FOR SHARE;
 SELECT * INTO p FROM "PropostaAcertoDesistenciaContratual" WHERE id=d."propostaId" FOR UPDATE;
 IF d.id IS NULL OR p.id IS NULL OR NOT d.aprovada OR NEW."executorId" IS DISTINCT FROM d."decisorId" OR NEW."condicoesHash" IS DISTINCT FROM p."condicoesHash" OR NEW."fotografiaHash" IS DISTINCT FROM p."fotografiaHash" OR NEW.memoria IS DISTINCT FROM p.memoria THEN RAISE EXCEPTION 'Aplicação exige decisão aprovada e memória correspondente'; END IF;
 PERFORM q165_autorizado(NEW."executorId",true); PERFORM q165_contexto(p.id);
 IF EXISTS (
   SELECT 1 FROM "AplicacaoAcertoDesistenciaContratual" aplicacao
   JOIN "DecisaoAcertoDesistenciaContratual" decisao ON decisao.id=aplicacao."decisaoId"
   JOIN "PropostaAcertoDesistenciaContratual" anterior ON anterior.id=decisao."propostaId"
   WHERE anterior."pedidoId"=p."pedidoId"
 ) THEN RAISE EXCEPTION 'Este pedido já possui aplicação Q165 pendente de efetivação.'; END IF;
 PERFORM q165_memoria(p.id); RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION q165_validar_efeitos_aplicacao(aplicacao_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE a "AplicacaoAcertoDesistenciaContratual"%ROWTYPE; p "PropostaAcertoDesistenciaContratual"%ROWTYPE; pe "PedidoDesistenciaPreparacao"%ROWTYPE; item JSONB; foto JSONB; fonte JSONB;
BEGIN
  SELECT * INTO a FROM "AplicacaoAcertoDesistenciaContratual" WHERE id=aplicacao_id FOR SHARE;
  SELECT * INTO p FROM "PropostaAcertoDesistenciaContratual" WHERE id=(SELECT "propostaId" FROM "DecisaoAcertoDesistenciaContratual" WHERE id=a."decisaoId") FOR SHARE;
  SELECT * INTO pe FROM "PedidoDesistenciaPreparacao" WHERE id=p."pedidoId" FOR SHARE;
  foto:=a.memoria->'fotografia';
  IF a.id IS NULL OR p.id IS NULL OR pe.id IS NULL OR jsonb_typeof(foto) IS DISTINCT FROM 'object'
    OR (SELECT count(*) FROM "Cobranca" WHERE "matriculaId"=pe."matriculaId") <> jsonb_array_length(a.memoria->'itens') THEN
    RAISE EXCEPTION 'Aplicação Q165 exige conjunto completo de cobranças aprovado';
  END IF;
  FOR item IN SELECT x FROM jsonb_array_elements(a.memoria->'itens') x LOOP
    IF NOT EXISTS (
      SELECT 1 FROM "Cobranca" c
      WHERE c.id=item->>'cobrancaId' AND c."matriculaId"=pe."matriculaId" AND c.moeda=item->>'moeda'
        AND c."valorNegociado" IS NOT DISTINCT FROM (item->>'devido')::numeric
        AND c.saldo IS NOT DISTINCT FROM (item->>'saldoDevido')::numeric
        AND ((item->>'saldoDevido')::numeric=0 AND c.status='PAGO' AND c."pagoEm" IS NOT NULL
          OR (item->>'saldoDevido')::numeric>0 AND c.status IN ('PENDENTE','ATRASADO') AND c."pagoEm" IS NULL)
    ) THEN RAISE EXCEPTION 'Cobrança não recebeu exatamente o efeito financeiro Q165 aprovado'; END IF;
    IF (item->>'creditoApurado')::numeric>0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM "OrigemCreditoAcertoDesistenciaContratual" o JOIN "CreditoMatricula" cr ON cr."origemAcertoDesistenciaContratualId"=o.id
        WHERE o."aplicacaoId"=a.id AND o."matriculaId"=pe."matriculaId" AND o."cobrancaId"=item->>'cobrancaId'
          AND o.valor IS NOT DISTINCT FROM (item->>'creditoApurado')::numeric AND o.moeda=item->>'moeda'
          AND cr."matriculaId"=pe."matriculaId" AND cr."valorInicial" IS NOT DISTINCT FROM o.valor AND cr.moeda=o.moeda
      ) THEN RAISE EXCEPTION 'Excedente Q165 exige origem e crédito correspondentes'; END IF;
    ELSIF EXISTS (SELECT 1 FROM "OrigemCreditoAcertoDesistenciaContratual" o WHERE o."aplicacaoId"=a.id AND o."cobrancaId"=item->>'cobrancaId') THEN
      RAISE EXCEPTION 'Aplicação Q165 não pode criar crédito sem excedente aprovado';
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM "OrigemCreditoAcertoDesistenciaContratual" WHERE "aplicacaoId"=a.id)
      <> (SELECT count(*) FROM jsonb_array_elements(a.memoria->'itens') x WHERE (x->>'creditoApurado')::numeric>0)
    OR EXISTS (SELECT 1 FROM "OrigemCreditoAcertoDesistenciaContratual" o LEFT JOIN "CreditoMatricula" cr ON cr."origemAcertoDesistenciaContratualId"=o.id WHERE o."aplicacaoId"=a.id AND cr.id IS NULL) THEN
    RAISE EXCEPTION 'Origens e créditos Q165 não comprovam todos os efeitos aprovados';
  END IF;

  -- A aplicação só pode alterar os valores previstos em `itens`, os créditos
  -- que ela própria origina e a versão das cobranças. Todo o resto permanece
  -- igual à fotografia aprovada até a efetivação, inclusive um recebimento
  -- posterior que deve continuar registrado como pendência e bloquear o ato.
  IF jsonb_array_length(COALESCE(foto->'financeiro'->'cobrancas','[]'::jsonb)) <> (SELECT count(*) FROM "Cobranca" WHERE "matriculaId"=pe."matriculaId")
    OR EXISTS (
      SELECT 1 FROM "Cobranca" c
      WHERE c."matriculaId"=pe."matriculaId" AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(foto->'financeiro'->'cobrancas') s WHERE s->>'id'=c.id
          AND s->>'tipo'=c.tipo::text AND s->>'moeda'=c.moeda
          AND s->>'vencimento'=to_char(c.vencimento AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          AND s->>'coberturaInicio' IS NOT DISTINCT FROM CASE WHEN c."coberturaInicio" IS NULL THEN NULL ELSE to_char(c."coberturaInicio" AT TIME ZONE 'UTC','YYYY-MM-DD') END
          AND s->>'coberturaFim' IS NOT DISTINCT FROM CASE WHEN c."coberturaFim" IS NULL THEN NULL ELSE to_char(c."coberturaFim" AT TIME ZONE 'UTC','YYYY-MM-DD') END
          AND (s->>'valorOriginal')::numeric IS NOT DISTINCT FROM c."valorOriginal"
          AND (s->>'valorRecebido')::numeric IS NOT DISTINCT FROM c."valorRecebido"
          AND (s->>'valorLiquidadoCredito')::numeric IS NOT DISTINCT FROM c."valorLiquidadoCredito"
          AND (s ? 'valorCompensadoPermuta') IS NOT DISTINCT FROM (c."valorCompensadoPermuta">0)
          AND (NOT (s ? 'valorCompensadoPermuta') OR (s->>'valorCompensadoPermuta')::numeric IS NOT DISTINCT FROM c."valorCompensadoPermuta")
      )
    ) THEN RAISE EXCEPTION 'Fonte financeira mudou depois da aplicação Q165; confira a pendência antes de efetivar'; END IF;

  FOR item IN SELECT x FROM jsonb_array_elements(foto->'financeiro'->'cobrancas') x LOOP
    IF EXISTS (
      SELECT 1 FROM "Cobranca" c WHERE c.id=item->>'id' AND c."matriculaId"=pe."matriculaId" AND (
        item->'fontes' IS DISTINCT FROM jsonb_build_object(
          'emissaoEntrada',(SELECT jsonb_build_object('itemId',ie.id,'emissaoId',ie."emissaoId",'etapa',ee.etapa,'condicoesId',ee."condicoesId",'criadaEm',to_char(ee."criadaEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) FROM "ItemEmissaoEntrada" ie JOIN "EmissaoCobrancasEntrada" ee ON ee.id=ie."emissaoId" WHERE ie."cobrancaId"=c.id ORDER BY ie.id LIMIT 1),
          'suspensaPorItemPausaId',c."suspensaPorItemPausaId",'canceladaPorPausaId',c."canceladaPorPausaId",
          'ajusteAcerto',(SELECT jsonb_build_object('id',aa.id,'decisaoId',aa."decisaoId",'valorNovo',to_char(aa."valorNovo",'FM999999999999999999990.00'),'criadoEm',to_char(aa."criadoEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) FROM "AjusteCobrancaAcerto" aa WHERE aa."cobrancaId"=c.id ORDER BY aa.id LIMIT 1),
          'emissaoFechamentoHoras',(SELECT jsonb_build_object('id',eh.id,'decisaoId',eh."decisaoId",'criadaEm',to_char(eh."criadaEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) FROM "EmissaoFechamentoHoras" eh WHERE eh."cobrancaId"=c.id ORDER BY eh.id LIMIT 1),
          'acertoMultaDecisaoId',c."acertoMultaDecisaoId")
      )
    ) THEN RAISE EXCEPTION 'Origem da cobrança mudou depois da aplicação Q165'; END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM "Cobranca" c WHERE c."matriculaId"=pe."matriculaId" AND (
      jsonb_array_length(COALESCE((SELECT s->'informes' FROM jsonb_array_elements(foto->'financeiro'->'cobrancas') s WHERE s->>'id'=c.id),'[]'::jsonb)) <> (SELECT count(*) FROM "PagamentoInformado" i WHERE i."cobrancaId"=c.id)
      OR EXISTS (SELECT 1 FROM "PagamentoInformado" i WHERE i."cobrancaId"=c.id AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements((SELECT s->'informes' FROM jsonb_array_elements(foto->'financeiro'->'cobrancas') s WHERE s->>'id'=c.id)) si WHERE si->>'id'=i.id AND si->>'status'=i.status::text AND (si->>'versao')::integer=i.versao AND (si->>'valor')::numeric=i.valor AND si->>'moeda'=i.moeda AND si->>'dataPagamento'=to_char(i."dataPagamento" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
      OR jsonb_array_length(COALESCE((SELECT s->'recebimentos' FROM jsonb_array_elements(foto->'financeiro'->'cobrancas') s WHERE s->>'id'=c.id),'[]'::jsonb)) <> (SELECT count(*) FROM "DestinacaoRecebimento" dr WHERE dr."cobrancaId"=c.id)
      OR EXISTS (SELECT 1 FROM "DestinacaoRecebimento" dr JOIN "Recebimento" r ON r.id=dr."recebimentoId" WHERE dr."cobrancaId"=c.id AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements((SELECT s->'recebimentos' FROM jsonb_array_elements(foto->'financeiro'->'cobrancas') s WHERE s->>'id'=c.id)) sr WHERE sr->>'id'=dr.id AND sr->>'recebimentoId'=r.id AND (sr->>'valor')::numeric=dr.valor AND sr->>'moeda'=r.moeda AND sr->>'dataPagamento'=to_char(r."dataPagamento" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
      OR jsonb_array_length(COALESCE((SELECT s->'utilizacoesCredito' FROM jsonb_array_elements(foto->'financeiro'->'cobrancas') s WHERE s->>'id'=c.id),'[]'::jsonb)) <> (SELECT count(*) FROM "PropostaUsoCredito" u WHERE u."cobrancaId"=c.id)
      OR EXISTS (SELECT 1 FROM "PropostaUsoCredito" u WHERE u."cobrancaId"=c.id AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements((SELECT s->'utilizacoesCredito' FROM jsonb_array_elements(foto->'financeiro'->'cobrancas') s WHERE s->>'id'=c.id)) su WHERE su->>'id'=u.id AND su->>'creditoId'=u."creditoId" AND (su->>'versao')::integer=u.versao AND (su->>'valor')::numeric=u.valor AND (su->'decisao' = 'null'::jsonb) IS NOT DISTINCT FROM (NOT EXISTS (SELECT 1 FROM "DecisaoUsoCredito" du WHERE du."propostaId"=u.id)) AND su->'decisao'->>'id' IS NOT DISTINCT FROM (SELECT du.id FROM "DecisaoUsoCredito" du WHERE du."propostaId"=u.id) AND su->'decisao'->>'aprovada' IS NOT DISTINCT FROM (SELECT CASE WHEN du.aprovada THEN 'true' ELSE 'false' END FROM "DecisaoUsoCredito" du WHERE du."propostaId"=u.id)))
      OR jsonb_array_length(COALESCE((SELECT s->'compensacoes' FROM jsonb_array_elements(foto->'financeiro'->'cobrancas') s WHERE s->>'id'=c.id),'[]'::jsonb)) <> (SELECT count(*) FROM "CompensacaoCoberturaMatricula" cc WHERE cc."cobrancaOrigemId"=c.id)
      OR EXISTS (SELECT 1 FROM "CompensacaoCoberturaMatricula" cc WHERE cc."cobrancaOrigemId"=c.id AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements((SELECT s->'compensacoes' FROM jsonb_array_elements(foto->'financeiro'->'cobrancas') s WHERE s->>'id'=c.id)) sc WHERE sc->>'id'=cc.id AND sc->>'status'=cc.status::text AND (sc->>'cobrancaVersao')::integer=cc."cobrancaVersao" AND sc->>'decididaEm' IS NOT DISTINCT FROM CASE WHEN cc."decididaEm" IS NULL THEN NULL ELSE to_char(cc."decididaEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AND jsonb_array_length(COALESCE(sc->'dias','[]'::jsonb))=(SELECT count(*) FROM "DiaCompensacaoCobertura" dc WHERE dc."compensacaoId"=cc.id) AND NOT EXISTS (SELECT 1 FROM "DiaCompensacaoCobertura" dc WHERE dc."compensacaoId"=cc.id AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(sc->'dias') sd WHERE sd->>'id'=dc.id AND sd->>'estado'=dc.estado::text AND (sd->>'versao')::integer=dc.versao))))
    )
  ) THEN RAISE EXCEPTION 'Recebimento ou informe posterior à aplicação Q165 exige nova conferência'; END IF;

  IF jsonb_array_length(COALESCE(foto->'financeiro'->'creditos','[]'::jsonb)) + (SELECT count(*) FROM "OrigemCreditoAcertoDesistenciaContratual" WHERE "aplicacaoId"=a.id) <> (SELECT count(*) FROM "CreditoMatricula" WHERE "matriculaId"=pe."matriculaId")
    OR EXISTS (SELECT 1 FROM "CreditoMatricula" cr WHERE cr."matriculaId"=pe."matriculaId" AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(foto->'financeiro'->'creditos') s WHERE s->>'id'=cr.id AND s->>'origemLiberacaoId' IS NOT DISTINCT FROM cr."origemLiberacaoId" AND s->>'origemAcertoId' IS NOT DISTINCT FROM cr."origemAcertoId" AND s->>'origemPeriodoIntegralId' IS NOT DISTINCT FROM cr."origemPeriodoIntegralId" AND s->>'origemDestinacaoRecebimentoId' IS NOT DISTINCT FROM cr."origemDestinacaoRecebimentoId" AND s->>'origemAcertoDesistenciaContratualId' IS NOT DISTINCT FROM cr."origemAcertoDesistenciaContratualId" AND (s->>'valorInicial')::numeric=cr."valorInicial" AND s->>'moeda'=cr.moeda AND s->>'criadoEm'=to_char(cr."criadoEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) AND NOT EXISTS (SELECT 1 FROM "OrigemCreditoAcertoDesistenciaContratual" o WHERE o."aplicacaoId"=a.id AND o.id=cr."origemAcertoDesistenciaContratualId")) THEN RAISE EXCEPTION 'Crédito adicional posterior à aplicação Q165 exige nova conferência'; END IF;
END $$;

COMMIT;
