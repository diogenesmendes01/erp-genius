-- Q165.255: a fotografia aprovada descreve a entrada; a aplicação também fixa o
-- ledger que resultou dela. A próxima reconferência só pode partir dessa saída.
ALTER TABLE "AplicacaoReconferenciaDeltaDesistencia"
  ADD COLUMN "fotografiaPosteriorHash" TEXT,
  ADD COLUMN "fotografiaPosterior" JSONB;

ALTER TABLE "AplicacaoReconferenciaDeltaDesistencia"
  ADD CONSTRAINT "AplicacaoReconferenciaDeltaDesistencia_fotografia_posterior_hash"
    CHECK ("fotografiaPosteriorHash" IS NULL OR "fotografiaPosteriorHash" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "AplicacaoReconferenciaDeltaDesistencia_fotografia_posterior_json"
    CHECK (("fotografiaPosteriorHash" IS NULL) = ("fotografiaPosterior" IS NULL)
      AND ("fotografiaPosterior" IS NULL OR jsonb_typeof("fotografiaPosterior")='object'));

CREATE OR REPLACE FUNCTION q165_guard_aplicacao_delta_249() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaReconferenciaDeltaDesistencia"%ROWTYPE;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF OLD."fotografiaPosteriorHash" IS NULL AND OLD."fotografiaPosterior" IS NULL
      AND NEW."fotografiaPosteriorHash" IS NOT NULL AND NEW."fotografiaPosterior" IS NOT NULL
      AND (SELECT xmin::text FROM "AplicacaoReconferenciaDeltaDesistencia" WHERE id=OLD.id) = (pg_current_xact_id()::text::bigint % 4294967296)::text
      AND (to_jsonb(NEW)-'fotografiaPosteriorHash'-'fotografiaPosterior')
        IS NOT DISTINCT FROM (to_jsonb(OLD)-'fotografiaPosteriorHash'-'fotografiaPosterior') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Aplicação delta é imutável fora da fotografia posterior única';
  ELSIF TG_OP<>'INSERT' THEN
    RAISE EXCEPTION 'Aplicação delta é imutável';
  END IF;
  SELECT * INTO proposta FROM "PropostaReconferenciaDeltaDesistencia" WHERE id=NEW."propostaId" FOR UPDATE;
  IF proposta.id IS NULL OR proposta.estado<>'PENDENTE' OR NOT EXISTS(
    SELECT 1 FROM "DecisaoReconferenciaDeltaDesistencia" financeira
    JOIN "DecisaoAdministrativaReconferenciaDeltaDesistencia" administrativa
      ON administrativa."propostaId"=financeira."propostaId" AND administrativa.aprovada
    WHERE financeira.id=NEW."decisaoFinanceiraId" AND financeira."propostaId"=proposta.id
      AND financeira.aprovada AND financeira."decisorId"=NEW."executorId"
      AND financeira."fotografiaHash"=NEW."fotografiaHash"
      AND proposta."aplicacaoBaseId"=NEW."aplicacaoBaseId"
      AND proposta."aplicacaoDeltaAnteriorId" IS NOT DISTINCT FROM NEW."aplicacaoDeltaAnteriorId"
  ) THEN RAISE EXCEPTION 'Aplicação delta exige proposta aplicável e decisões aprovadas'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION q165_delta_decisoes_vigentes_255(aplicacao_id TEXT) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS(
    SELECT 1 FROM "AplicacaoReconferenciaDeltaDesistencia" aplicacao
    JOIN "PropostaReconferenciaDeltaDesistencia" proposta ON proposta.id=aplicacao."propostaId"
    JOIN "DecisaoReconferenciaDeltaDesistencia" financeira ON financeira.id=aplicacao."decisaoFinanceiraId"
    JOIN "Usuario" decisor_financeiro ON decisor_financeiro.id=financeira."decisorId"
    JOIN "DecisaoAdministrativaReconferenciaDeltaDesistencia" administrativa ON administrativa."propostaId"=proposta.id
    JOIN "Usuario" decisor_administrativo ON decisor_administrativo.id=administrativa."decisorId"
    WHERE aplicacao.id=aplicacao_id AND financeira.aprovada AND administrativa.aprovada
      AND financeira."decisorId"<>proposta."preparadorId" AND administrativa."decisorId"<>proposta."preparadorId"
      AND decisor_financeiro.ativo AND decisor_administrativo.ativo
      AND ('ADMINISTRADOR'=ANY(decisor_financeiro.papeis) OR ('FINANCEIRO'=ANY(decisor_financeiro.papeis) AND 'financeiro.aprovar_acertos'=ANY(decisor_financeiro.permissoes)))
      AND 'ADMINISTRADOR'=ANY(decisor_administrativo.papeis)
  )
$$;
CREATE OR REPLACE FUNCTION q165_delta_contexto_249(proposta_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE p "PropostaReconferenciaDeltaDesistencia"%ROWTYPE; base "AplicacaoAcertoDesistenciaContratual"%ROWTYPE; decisao_base "DecisaoAcertoDesistenciaContratual"%ROWTYPE; proposta_base "PropostaAcertoDesistenciaContratual"%ROWTYPE; ultimo "AplicacaoReconferenciaDeltaDesistencia"%ROWTYPE; pe "PedidoDesistenciaPreparacao"%ROWTYPE; cond "CondicoesEncerramentoMatricula"%ROWTYPE; m "Matricula"%ROWTYPE;
BEGIN
 SELECT * INTO p FROM "PropostaReconferenciaDeltaDesistencia" WHERE id=proposta_id FOR UPDATE;
 SELECT * INTO base FROM "AplicacaoAcertoDesistenciaContratual" WHERE id=p."aplicacaoBaseId" FOR SHARE;
 SELECT * INTO decisao_base FROM "DecisaoAcertoDesistenciaContratual" WHERE id=base."decisaoId" FOR SHARE;
 SELECT * INTO proposta_base FROM "PropostaAcertoDesistenciaContratual" WHERE id=decisao_base."propostaId" FOR SHARE;
 SELECT * INTO pe FROM "PedidoDesistenciaPreparacao" WHERE id=proposta_base."pedidoId" FOR UPDATE;
 SELECT * INTO cond FROM "CondicoesEncerramentoMatricula" WHERE id=proposta_base."condicoesId" FOR SHARE;
 SELECT * INTO m FROM "Matricula" WHERE id=pe."matriculaId" FOR UPDATE;
 SELECT * INTO ultimo FROM "AplicacaoReconferenciaDeltaDesistencia" WHERE "aplicacaoBaseId"=base.id ORDER BY "criadaEm" DESC,id DESC LIMIT 1 FOR UPDATE;
 PERFORM id FROM "Cobranca" WHERE "matriculaId"=pe."matriculaId" ORDER BY id FOR UPDATE;
 IF p.id IS NULL OR base.id IS NULL OR decisao_base.id IS NULL OR proposta_base.id IS NULL OR pe.id IS NULL OR cond.id IS NULL OR m.id IS NULL
   OR NOT decisao_base.aprovada OR p."pedidoId" IS DISTINCT FROM proposta_base."pedidoId" OR p."condicoesId" IS DISTINCT FROM proposta_base."condicoesId"
   OR p."estadoHash" IS DISTINCT FROM proposta_base."estadoHash" OR p."condicoesHash" IS DISTINCT FROM base."condicoesHash"
   OR p."aplicacaoDeltaAnteriorId" IS DISTINCT FROM ultimo.id
   OR (ultimo.id IS NULL AND p."fotografiaAnteriorHash" IS DISTINCT FROM base."fotografiaHash")
   OR (ultimo.id IS NOT NULL AND ultimo."fotografiaPosteriorHash" IS NOT NULL AND p."fotografiaAnteriorHash" IS DISTINCT FROM ultimo."fotografiaPosteriorHash")
   OR (ultimo.id IS NOT NULL AND ultimo."fotografiaPosteriorHash" IS NOT NULL AND p."fotografiaHash"=ultimo."fotografiaPosteriorHash" AND q165_delta_decisoes_vigentes_255(ultimo.id))
   -- Linha legada não é reescrita: ela pode ser reancorada uma vez por uma nova
   -- proposta, desde que o servidor tenha comprovado mudança na foto anterior.
   OR (ultimo.id IS NOT NULL AND ultimo."fotografiaPosteriorHash" IS NULL AND p."fotografiaAnteriorHash" IS DISTINCT FROM ultimo."fotografiaHash")
   OR (ultimo.id IS NOT NULL AND ultimo."fotografiaPosteriorHash" IS NULL AND p."fotografiaHash"=ultimo."fotografiaHash" AND q165_delta_decisoes_vigentes_255(ultimo.id))
   OR p.versao <> COALESCE((SELECT max(x.versao)+1 FROM "PropostaReconferenciaDeltaDesistencia" x WHERE x."aplicacaoBaseId"=base.id AND x.id<>p.id),1)
   OR m.status NOT IN ('RASCUNHO','AGUARDANDO') OR m."ativadaEm" IS NOT NULL OR EXISTS(SELECT 1 FROM "PedidoDesistenciaPreparacao" x WHERE x."matriculaId"=m.id AND x.versao>pe.versao)
   OR EXISTS(SELECT 1 FROM "CondicoesEncerramentoMatricula" x WHERE x."matriculaId"=m.id AND x.versao>cond.versao)
   OR NOT q165_fonte_condicoes_valida(cond.id,true) THEN RAISE EXCEPTION 'Reconferência delta não corresponde à cadeia, fonte contratual ou matrícula atual'; END IF;
END $$;

CREATE OR REPLACE FUNCTION q165_valor_255(valor NUMERIC) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT to_char(valor, 'FM9999999990.00')
$$;
CREATE OR REPLACE FUNCTION q165_data_255(data TIMESTAMP) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT to_char(data, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

-- A mesma forma usada pelo carregador Node. A comparação abaixo é estrutural e
-- completa, e o hash usa q165_json_canon já compartilhado com hashSubstituicao.
CREATE OR REPLACE FUNCTION q165_fotografia_delta_atual_255(matricula_id TEXT) RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'matriculaId', matricula_id,
    'cobrancas', COALESCE((SELECT jsonb_agg(
      jsonb_build_object(
        'id', cobranca.id, 'versao', cobranca.versao, 'tipo', cobranca.tipo::text, 'status', cobranca.status::text,
        'moeda', cobranca.moeda, 'vencimento', q165_data_255(cobranca.vencimento),
        'coberturaInicio', CASE WHEN cobranca."coberturaInicio" IS NULL THEN NULL ELSE to_char(cobranca."coberturaInicio", 'YYYY-MM-DD') END,
        'coberturaFim', CASE WHEN cobranca."coberturaFim" IS NULL THEN NULL ELSE to_char(cobranca."coberturaFim", 'YYYY-MM-DD') END,
        'valorOriginal', q165_valor_255(cobranca."valorOriginal"), 'valorNegociado', q165_valor_255(cobranca."valorNegociado"),
        'valorRecebido', CASE WHEN cobranca."valorRecebido" IS NULL THEN NULL ELSE q165_valor_255(cobranca."valorRecebido") END,
        'valorLiquidadoCredito', q165_valor_255(cobranca."valorLiquidadoCredito"),
        'saldo', CASE WHEN cobranca.saldo IS NULL THEN NULL ELSE q165_valor_255(cobranca.saldo) END,
        'pagoEm', CASE WHEN cobranca."pagoEm" IS NULL THEN NULL ELSE q165_data_255(cobranca."pagoEm") END,
        'fontes', jsonb_build_object(
          'emissaoEntrada', (SELECT CASE WHEN item.id IS NULL THEN NULL ELSE jsonb_build_object('itemId',item.id,'emissaoId',emissao.id,'etapa',emissao.etapa,'condicoesId',emissao."condicoesId",'criadaEm',q165_data_255(emissao."criadaEm")) END FROM "ItemEmissaoEntrada" item JOIN "EmissaoCobrancasEntrada" emissao ON emissao.id=item."emissaoId" WHERE item."cobrancaId"=cobranca.id),
          'suspensaPorItemPausaId', cobranca."suspensaPorItemPausaId", 'canceladaPorPausaId', cobranca."canceladaPorPausaId",
          'ajusteAcerto', (SELECT CASE WHEN ajuste.id IS NULL THEN NULL ELSE jsonb_build_object('id',ajuste.id,'decisaoId',ajuste."decisaoId",'valorNovo',q165_valor_255(ajuste."valorNovo"),'criadaEm',q165_data_255(ajuste."criadoEm")) END FROM "AjusteCobrancaAcerto" ajuste WHERE ajuste."cobrancaId"=cobranca.id),
          'emissaoFechamentoHoras', (SELECT CASE WHEN emissao_horas.id IS NULL THEN NULL ELSE jsonb_build_object('id',emissao_horas.id,'decisaoId',emissao_horas."decisaoId",'criadaEm',q165_data_255(emissao_horas."criadaEm")) END FROM "EmissaoFechamentoHoras" emissao_horas WHERE emissao_horas."cobrancaId"=cobranca.id),
          'acertoMultaDecisaoId', cobranca."acertoMultaDecisaoId"
        ),
        'informes', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',informe.id,'status',informe.status::text,'versao',informe.versao,'valor',q165_valor_255(informe.valor),'moeda',informe.moeda,'dataPagamento',q165_data_255(informe."dataPagamento")) ORDER BY informe.id) FROM "PagamentoInformado" informe WHERE informe."cobrancaId"=cobranca.id),'[]'::jsonb),
        'recebimentos', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',destino.id,'recebimentoId',recebimento.id,'valor',q165_valor_255(destino.valor),'moeda',recebimento.moeda,'dataPagamento',q165_data_255(recebimento."dataPagamento")) ORDER BY destino.id) FROM "DestinacaoRecebimento" destino JOIN "Recebimento" recebimento ON recebimento.id=destino."recebimentoId" WHERE destino."cobrancaId"=cobranca.id),'[]'::jsonb),
        'utilizacoesCredito', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',uso.id,'creditoId',uso."creditoId",'versao',uso.versao,'valor',q165_valor_255(uso.valor),'decisao',CASE WHEN decisao_uso.id IS NULL THEN NULL ELSE jsonb_build_object('id',decisao_uso.id,'aprovada',decisao_uso.aprovada,'decididaEm',q165_data_255(decisao_uso."decididaEm")) END) ORDER BY uso.id) FROM "PropostaUsoCredito" uso LEFT JOIN "DecisaoUsoCredito" decisao_uso ON decisao_uso."propostaId"=uso.id WHERE uso."cobrancaId"=cobranca.id),'[]'::jsonb),
        'compensacoes', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',compensacao.id,'status',compensacao.status::text,'cobrancaVersao',compensacao."cobrancaVersao",'decididaEm',CASE WHEN compensacao."decididaEm" IS NULL THEN NULL ELSE q165_data_255(compensacao."decididaEm") END,'dias',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',dia.id,'estado',dia.estado::text,'versao',dia.versao) ORDER BY dia.id) FROM "DiaCompensacaoCobertura" dia WHERE dia."compensacaoId"=compensacao.id),'[]'::jsonb)) ORDER BY compensacao.id) FROM "CompensacaoCoberturaMatricula" compensacao WHERE compensacao."cobrancaOrigemId"=cobranca.id),'[]'::jsonb)
      ) || CASE WHEN cobranca."valorCompensadoPermuta">0 THEN jsonb_build_object('valorCompensadoPermuta',q165_valor_255(cobranca."valorCompensadoPermuta")) ELSE '{}'::jsonb END
      ORDER BY cobranca.id) FROM "Cobranca" cobranca WHERE cobranca."matriculaId"=matricula_id),'[]'::jsonb),
    'creditos', COALESCE((SELECT jsonb_agg(
      jsonb_build_object('id',credito.id,'origemLiberacaoId',credito."origemLiberacaoId",'origemAcertoId',credito."origemAcertoId",'origemPeriodoIntegralId',credito."origemPeriodoIntegralId",'origemDestinacaoRecebimentoId',credito."origemDestinacaoRecebimentoId",'origemAcertoDesistenciaContratualId',credito."origemAcertoDesistenciaContratualId",'valorInicial',q165_valor_255(credito."valorInicial"),'moeda',credito.moeda,'criadoEm',q165_data_255(credito."criadoEm"),'origemAcertoTaxaAditivoId',credito."origemAcertoTaxaAditivoId",'saldoDisponivel',q165_valor_255(credito."valorInicial"-coalesce((SELECT sum(uso.valor) FROM "PropostaUsoCredito" uso JOIN "DecisaoUsoCredito" decisao_uso ON decisao_uso."propostaId"=uso.id AND decisao_uso.aprovada WHERE uso."creditoId"=credito.id),0)-coalesce((SELECT sum(reserva.valor) FROM "ReservaDevolucaoCredito" reserva WHERE reserva."creditoId"=credito.id AND reserva.estado<>'LIBERADA'),0))
      ) || CASE WHEN credito."origemReconferenciaDeltaDesistenciaId" IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('origemReconferenciaDeltaDesistenciaId',credito."origemReconferenciaDeltaDesistenciaId") END
      ORDER BY credito.id) FROM "CreditoMatricula" credito WHERE credito."matriculaId"=matricula_id),'[]'::jsonb)
  )
$$;

CREATE OR REPLACE FUNCTION q165_delta_fotografia_posterior_255(aplicacao_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE aplicacao "AplicacaoReconferenciaDeltaDesistencia"%ROWTYPE; proposta "PropostaReconferenciaDeltaDesistencia"%ROWTYPE; pedido "PedidoDesistenciaPreparacao"%ROWTYPE; atual JSONB;
BEGIN
  SELECT * INTO aplicacao FROM "AplicacaoReconferenciaDeltaDesistencia" WHERE id=aplicacao_id FOR SHARE;
  SELECT * INTO proposta FROM "PropostaReconferenciaDeltaDesistencia" WHERE id=aplicacao."propostaId" FOR SHARE;
  SELECT pedido_q165.* INTO pedido FROM "PedidoDesistenciaPreparacao" pedido_q165
    JOIN "PropostaAcertoDesistenciaContratual" proposta_base ON proposta_base."pedidoId"=pedido_q165.id
    JOIN "DecisaoAcertoDesistenciaContratual" decisao_base ON decisao_base."propostaId"=proposta_base.id
    JOIN "AplicacaoAcertoDesistenciaContratual" base ON base."decisaoId"=decisao_base.id
    WHERE base.id=aplicacao."aplicacaoBaseId";
  IF aplicacao.id IS NULL OR proposta.id IS NULL OR pedido.id IS NULL OR aplicacao."fotografiaPosteriorHash" IS NULL OR aplicacao."fotografiaPosterior" IS NULL THEN
    RAISE EXCEPTION 'Aplicação delta exige fotografia posterior completa';
  END IF;
  IF aplicacao."fotografiaPosterior"->>'matriculaId' IS DISTINCT FROM pedido."matriculaId"
    OR aplicacao."fotografiaPosteriorHash" IS DISTINCT FROM encode(digest(q165_json_canon(aplicacao."fotografiaPosterior"),'sha256'),'hex') THEN
    RAISE EXCEPTION 'Fotografia posterior delta possui vínculo ou hash inválido';
  END IF;
  atual:=q165_fotografia_delta_atual_255(pedido."matriculaId");
  IF q165_json_canon(aplicacao."fotografiaPosterior") IS DISTINCT FROM q165_json_canon(atual) THEN
    RAISE EXCEPTION 'Fotografia posterior delta não corresponde integralmente ao ledger';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION q165_delta_fotografia_posterior_trigger_255() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN PERFORM q165_delta_fotografia_posterior_255(NEW.id); RETURN NEW; END $$;
CREATE CONSTRAINT TRIGGER q165_delta_fotografia_posterior_255
AFTER INSERT OR UPDATE OF "fotografiaPosteriorHash", "fotografiaPosterior" ON "AplicacaoReconferenciaDeltaDesistencia"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION q165_delta_fotografia_posterior_trigger_255();

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
   PERFORM q165_delta_fotografia_posterior_255(ultima);
 END IF;
END $$;
