-- Q173, R2 do #284. Mesma classe da R1: direito em andamento na moeda anterior que ficaria sem saída depois da troca.
-- pendencias_moeda_antiga_173 (redefinida a partir de 20261021220000, conferida por diff -w) ganha:
--   ADIANTAMENTO_SEM_COMPRA (B1) e HORAS_A_FATURAR (B3); e SALDO_SERVICOS_PERMUTA passa a descontar só os usos
--   aprovados (M1).
-- B2: a devolução de minutos (Q175) é recusada quando a compra está numa moeda diferente da matrícula, isto é, foi
-- feita antes de uma troca de moeda. Opção conservadora: recusar, e não registrar a devolução como pendência sem
-- estorno, porque não há caminho para usar ou liquidar minutos na moeda antiga. O tratamento dessa aula (por exemplo,
-- crédito na moeda da compra) fica com o dono. A correção acadêmica segue possível sem a declaração de não cobrável.
-- q23_fotografia_nao_cobravel_reserva_175 e guardar_estorno_consumo_horas_175 redefinidas a partir da definição vigente
-- (20261020510000_estorno_consumo_horas_nao_cobravel, conferida por diff -w): só o ramo da moeda.
-- As tabelas da Q171 nascem depois deste range (20261021300000): como na 220000, o corpo SQL não é validado na criação.
SET check_function_bodies = off;

CREATE OR REPLACE FUNCTION pendencias_moeda_antiga_173(matricula_id TEXT, moeda_antiga TEXT, vigencia TIMESTAMP, fuso TEXT)
RETURNS TEXT[] LANGUAGE sql STABLE AS $$
  SELECT coalesce(array_agg(p ORDER BY p), ARRAY[]::TEXT[]) FROM (
    SELECT 'COBRANCA_EM_ABERTO' AS p WHERE EXISTS (SELECT 1 FROM "Cobranca" c WHERE c."matriculaId"=matricula_id AND c.moeda=moeda_antiga AND c.status IN ('PENDENTE','ATRASADO'))
    UNION ALL SELECT 'COMPROVANTE_A_CONFERIR' WHERE EXISTS (SELECT 1 FROM "PagamentoInformado" pi JOIN "Cobranca" c ON c.id=pi."cobrancaId" WHERE c."matriculaId"=matricula_id AND c.moeda=moeda_antiga AND pi.status='A_CONFERIR')
    UNION ALL SELECT 'COBERTURA_MENSAL_ALEM_DA_VIGENCIA' WHERE EXISTS (SELECT 1 FROM "Cobranca" c WHERE c."matriculaId"=matricula_id AND c.moeda=moeda_antiga AND c.tipo='MENSALIDADE' AND c.status<>'CANCELADA' AND c."coberturaFim" IS NOT NULL
      AND c."coberturaFim" >= ((vigencia AT TIME ZONE 'UTC') AT TIME ZONE fuso)::date)
    -- "Reserva pendente" (sexta rodada): reserva de horas pré-pagas ainda não consumida nem convertida em crédito
    -- conta como saldo; reserva liberada para remarcação devolve os minutos ao saldo.
    UNION ALL SELECT 'SALDO_HORAS_PRE_PAGAS' WHERE EXISTS (
      SELECT 1 FROM "CompraHorasAntecipadas" ch WHERE ch."matriculaId"=matricula_id AND ch.moeda=moeda_antiga
        AND ch."minutosComprados" > coalesce((SELECT lq.minutos FROM "LiquidacaoHorasAcerto" lq WHERE lq."compraId"=ch.id), 0) + coalesce((
          SELECT sum(r.minutos) FROM "ReservaHorasCompradas" r WHERE r."compraId"=ch.id
            AND (EXISTS (SELECT 1 FROM "ConsumoHorasCompradas" co WHERE co."reservaId"=r.id AND NOT EXISTS (SELECT 1 FROM "EstornoConsumoHorasCompradas" es WHERE es."consumoId"=co.id))
              OR EXISTS (SELECT 1 FROM "DecisaoLiberacaoHoras" d JOIN "PropostaLiberacaoHoras" pl ON pl.id=d."propostaId" WHERE d."reservaId"=r.id AND d.aprovada AND pl.destino='CREDITO'))), 0))
    UNION ALL SELECT 'PERMUTA_VIGENTE' WHERE EXISTS (SELECT 1 FROM "AcordoPermutaServico" a WHERE a."matriculaId"=matricula_id AND a.moeda=moeda_antiga
      AND a."vigenciaFim" >= ((vigencia AT TIME ZONE 'UTC') AT TIME ZONE fuso)::date)
    -- R1 do #284: direitos em andamento na moeda anterior. A decisão e a aplicação de cada um exigem a moeda da
    -- matrícula igual à da cobrança de origem; depois da troca, ficariam sem caminho.
    UNION ALL SELECT 'COMPENSACAO_COBERTURA_PENDENTE' WHERE EXISTS (SELECT 1 FROM "CompensacaoCoberturaMatricula" cc
      WHERE cc."matriculaId"=matricula_id AND cc.moeda=moeda_antiga AND cc.status='PENDENTE')
    UNION ALL SELECT 'DIAS_COMPENSACAO_PENDENTES' WHERE EXISTS (SELECT 1 FROM "DiaCompensacaoCobertura" dc JOIN "CompensacaoCoberturaMatricula" cc ON cc.id=dc."compensacaoId"
      WHERE cc."matriculaId"=matricula_id AND cc.moeda=moeda_antiga AND dc.estado='PENDENTE')
    -- Só a versão mais recente de cada proposta conta: a revisada foi substituída pela sucessora.
    UNION ALL SELECT 'PERIODO_INTEGRAL_PENDENTE' WHERE EXISTS (SELECT 1 FROM "PropostaPeriodoIntegral" pp JOIN "Cobranca" c ON c.id=pp."cobrancaId"
      LEFT JOIN "DecisaoPeriodoIntegral" d ON d."propostaId"=pp.id LEFT JOIN "AplicacaoPeriodoIntegral" ap ON ap."decisaoId"=d.id
      WHERE pp."matriculaId"=matricula_id AND c.moeda=moeda_antiga AND NOT EXISTS (SELECT 1 FROM "PropostaPeriodoIntegral" s WHERE s."anteriorId"=pp.id)
        AND (d.id IS NULL OR (d.aprovada AND ap.id IS NULL)))
    UNION ALL SELECT 'PERMUTA_SERVICO_SEM_COMPENSACAO' WHERE EXISTS (SELECT 1 FROM "ConfirmacaoServicoPermuta" cf JOIN "AcordoPermutaServico" a ON a.id=cf."acordoId"
      WHERE a."matriculaId"=matricula_id AND a.moeda=moeda_antiga
        AND NOT EXISTS (SELECT 1 FROM "PropostaCompensacaoPermuta" pc JOIN "DecisaoCompensacaoPermuta" d ON d."propostaId"=pc.id AND d.aprovada WHERE pc."confirmacaoId"=cf.id))
    -- Q175: aplicada depois da troca, a devolução recriaria saldo de horas pré-pagas na moeda antiga.
    UNION ALL SELECT 'REVISAO_CORRECAO_AULA_DEVOLVE_MINUTOS' WHERE EXISTS (SELECT 1 FROM "PropostaRevisaoFinanceiraCorrecaoAula" r
      JOIN "PropostaCorrecaoAula" pc ON pc.id=r."propostaCorrecaoAulaId" JOIN "EncontroAgenda" e ON e.id=pc."encontroId"
      WHERE e."matriculaId"=matricula_id AND r.fotografia->'efeito'->>'tipo'='DEVOLVE_MINUTOS' AND r.fotografia->'efeito'->>'moeda'=moeda_antiga
        AND NOT EXISTS (SELECT 1 FROM "RejeicaoCorrecaoAula" x WHERE x."propostaId"=pc.id)
        AND NOT EXISTS (SELECT 1 FROM "AprovacaoCorrecaoAula" x WHERE x."propostaId"=pc.id)
        AND NOT EXISTS (SELECT 1 FROM "PropostaCorrecaoAula" pc2 WHERE pc2."encontroId"=pc."encontroId" AND pc2.versao>pc.versao)
        AND NOT EXISTS (SELECT 1 FROM "PropostaRevisaoFinanceiraCorrecaoAula" r2 WHERE r2."propostaCorrecaoAulaId"=r."propostaCorrecaoAulaId" AND r2.versao>r.versao)
        AND NOT EXISTS (SELECT 1 FROM "DecisaoRevisaoFinanceiraCorrecaoAula" d WHERE d."propostaId"=r.id AND NOT d.aprovada))
    -- Q171 (#283): saldo restrito a serviços na moeda anterior ainda não usado por decisão aprovada (M1 da R2: o uso
    -- pendente não esconde o saldo, porque pode acabar rejeitado depois da troca)
    -- não tem onde ser usado depois da troca; a destinação de excedente sem decisão o criaria. Até o dono decidir,
    -- os dois bloqueiam a troca.
    UNION ALL SELECT 'SALDO_SERVICOS_PERMUTA' WHERE EXISTS (SELECT 1 FROM "SaldoServicoPermuta" s
      WHERE s."matriculaId"=matricula_id AND s.moeda=moeda_antiga
        AND s."valorInicial" > coalesce((SELECT sum(u.valor) FROM "PropostaUsoSaldoServicoPermuta" u JOIN "DecisaoUsoSaldoServicoPermuta" du ON du."propostaId"=u.id AND du.aprovada WHERE u."saldoId"=s.id), 0))
    UNION ALL SELECT 'DESTINACAO_EXCEDENTE_PENDENTE' WHERE EXISTS (SELECT 1 FROM "PropostaDestinacaoExcedentePermuta" pd
      WHERE pd."matriculaId"=matricula_id AND pd.moeda=moeda_antiga
        AND NOT EXISTS (SELECT 1 FROM "DecisaoDestinacaoExcedentePermuta" d WHERE d."propostaId"=pd.id))
    -- R2 do #284, B1: adiantamento de horas pago na moeda anterior e ainda sem compra registrada. Depois da troca, a
    -- compra é recusada (moeda da cobrança ≠ matrícula) e o pago sumiria do encerramento. A cobrança HORA_PARTICULAR
    -- emitida pelo fechamento de horas (aula pós-paga) não é adiantamento.
    UNION ALL SELECT 'ADIANTAMENTO_SEM_COMPRA' WHERE EXISTS (SELECT 1 FROM "Cobranca" c WHERE c."matriculaId"=matricula_id AND c.moeda=moeda_antiga
      AND c.tipo='HORA_PARTICULAR' AND c.status='PAGO'
      AND NOT EXISTS (SELECT 1 FROM "CompraHorasAntecipadas" ch WHERE ch."cobrancaId"=c.id)
      AND NOT EXISTS (SELECT 1 FROM "EmissaoFechamentoHoras" ef WHERE ef."cobrancaId"=c.id))
    -- R2 do #284, B3: hora pós-paga ainda não faturada. (a) conferência com valor na moeda anterior sem item faturado,
    -- sem declaração de não cobrável e sem consumo de antecipação; (b) em matrícula com condições de horas, encontro
    -- particular anterior à vigência ainda sem conferência e sem reserva de horas (o mesmo que o fechamento trata como
    -- "ocorrência ainda não conferida"). Depois da troca, o fechamento recusa a conferência de outra moeda e a prévia
    -- exige condições na moeda nova: a aula nunca seria faturada.
    UNION ALL SELECT 'HORAS_A_FATURAR' WHERE EXISTS (SELECT 1 FROM "ConferenciaOcorrenciaHoras" co JOIN "EncontroAgenda" e ON e.id=co."encontroId"
        WHERE e."matriculaId"=matricula_id AND co.moeda=moeda_antiga AND co.valor > 0
          AND NOT EXISTS (SELECT 1 FROM "ItemFechamentoHoras" i WHERE i."conferenciaId"=co.id)
          AND NOT EXISTS (SELECT 1 FROM "AplicacaoRevisaoFinanceiraCorrecaoAula" a WHERE a."conferenciaId"=co.id)
          AND NOT EXISTS (SELECT 1 FROM "ConsumoHorasCompradas" ca WHERE ca."conferenciaOcorrenciaId"=co.id))
      OR EXISTS (SELECT 1 FROM "EncontroAgenda" e WHERE e."matriculaId"=matricula_id AND e."turmaId" IS NULL AND e.finalidade='AULA' AND e.status<>'RASCUNHO'
          AND e.inicio < vigencia
          AND EXISTS (SELECT 1 FROM "CondicoesHorasMatricula" ch WHERE ch."matriculaId"=matricula_id)
          AND NOT EXISTS (SELECT 1 FROM "ConferenciaOcorrenciaHoras" co WHERE co."encontroId"=e.id)
          AND NOT EXISTS (SELECT 1 FROM "ReservaHorasCompradas" r WHERE r."encontroId"=e.id))
  ) pendencias
$$;

RESET check_function_bodies;

CREATE OR REPLACE FUNCTION q23_fotografia_nao_cobravel_reserva_175(_proposta_id TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE _p "PropostaCorrecaoAula"%ROWTYPE; _e "EncontroAgenda"%ROWTYPE; _d "AulaDiario"%ROWTYPE;
  _res "ReservaHorasCompradas"%ROWTYPE; _con "ConsumoHorasCompradas"%ROWTYPE; _cmp "CompraHorasAntecipadas"%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT p.* INTO _p FROM "PropostaCorrecaoAula" p WHERE p.id=_proposta_id FOR SHARE;
  IF NOT FOUND OR EXISTS (SELECT 1 FROM "RejeicaoCorrecaoAula" r WHERE r."propostaId"=_p.id)
    OR EXISTS (SELECT 1 FROM "AprovacaoCorrecaoAula" a WHERE a."propostaId"=_p.id)
    OR _p.versao IS DISTINCT FROM (SELECT max(versao) FROM "PropostaCorrecaoAula" WHERE "encontroId"=_p."encontroId") THEN RETURN NULL; END IF;
  SELECT e.* INTO _e FROM "EncontroAgenda" e WHERE e.id=_p."encontroId" FOR UPDATE;
  IF NOT FOUND OR _e."matriculaId" IS NULL OR _e.finalidade::text<>'AULA' OR _e.status::text<>'MINISTRADO' THEN RETURN NULL; END IF;
  PERFORM m.id FROM "Matricula" m WHERE m.id=_e."matriculaId" FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF (SELECT count(*) FROM "ReservaHorasCompradas" r WHERE r."encontroId"=_e.id)<>1 THEN RETURN NULL; END IF;
  SELECT r.* INTO _res FROM "ReservaHorasCompradas" r WHERE r."encontroId"=_e.id FOR UPDATE;
  SELECT c.* INTO _con FROM "ConsumoHorasCompradas" c WHERE c."reservaId"=_res.id FOR UPDATE;
  SELECT c.* INTO _cmp FROM "CompraHorasAntecipadas" c WHERE c.id=_res."compraId" FOR UPDATE;
  SELECT d.* INTO _d FROM "AulaDiario" d WHERE d.id=_p."diarioId" FOR SHARE;
  IF _con.id IS NULL OR _cmp.id IS NULL OR _d.id IS NULL OR _cmp."matriculaId" IS DISTINCT FROM _e."matriculaId"
    OR _res.inicio IS DISTINCT FROM _e.inicio OR _res.fim IS DISTINCT FROM _e.fim
    OR _res.minutos IS DISTINCT FROM extract(epoch FROM (_e.fim-_e.inicio))::integer/60
    OR EXISTS (SELECT 1 FROM "DecisaoLiberacaoHoras" l WHERE l."reservaId"=_res.id AND l.aprovada)
    OR EXISTS (SELECT 1 FROM "EstornoConsumoHorasCompradas" es WHERE es."consumoId"=_con.id)
    -- Compra já liquidada no encerramento não recebe minutos de volta.
    OR EXISTS (SELECT 1 FROM "LiquidacaoHorasAcerto" lq WHERE lq."compraId"=_cmp.id)
    -- Q173 (R2 do #284, B2): compra na moeda anterior a uma troca não recebe minutos de volta; recriaria saldo
    -- que não pode mais ser consumido nem liquidado.
    OR _cmp.moeda IS DISTINCT FROM (SELECT m.moeda FROM "Matricula" m WHERE m.id=_e."matriculaId") THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('versao',1,'tipo','AULA_NAO_COBRAVEL','propostaId',_p.id,'propostaHash',_p."entradaHash",'versaoCorrecaoAula',_p.versao,'estadoHash',_p."estadoHash",
    'encontro',jsonb_build_object('id',_e.id,'matriculaId',_e."matriculaId",'status',_e.status::text,'inicio',_e.inicio,'fim',_e.fim,'professorId',_e."professorId"),
    'diario',jsonb_build_object('id',_d.id,'conteudoHash',encode(digest(_d.conteudo,'sha256'),'hex')),
    'conferencia',CASE WHEN _con."conferenciaOcorrenciaId" IS NULL THEN NULL ELSE jsonb_build_object('id',_con."conferenciaOcorrenciaId") END,
    'reservaConsumida',jsonb_build_object('id',_res.id,'minutos',_res.minutos,'inicio',_res.inicio,'fim',_res.fim,'consumoId',_con.id,'conferenciaOcorrenciaId',_con."conferenciaOcorrenciaId"),
    'compraAntecipada',jsonb_build_object('id',_cmp.id,'cobrancaId',_cmp."cobrancaId",'minutosComprados',_cmp."minutosComprados",'valorPagoAlocado',_cmp."valorPagoAlocado",'moeda',_cmp.moeda,'entradaHash',_cmp."entradaHash"),
    'cobranca',NULL,'item',NULL,
    'efeito',jsonb_build_object('tipo','DEVOLVE_MINUTOS','valorAula',0,'moeda',_cmp.moeda,'reservaId',_res.id,'consumoId',_con.id,'compraId',_cmp.id,'minutos',_res.minutos),
    'informesPagamento','[]'::jsonb,'recebimentos','[]'::jsonb,'destinacoes','[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION guardar_estorno_consumo_horas_175() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE _a "AplicacaoRevisaoFinanceiraCorrecaoAula"%ROWTYPE; _r "PropostaRevisaoFinanceiraCorrecaoAula"%ROWTYPE; _ef JSONB;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Estorno de consumo de horas é imutável'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
  SELECT * INTO _a FROM "AplicacaoRevisaoFinanceiraCorrecaoAula" WHERE id=NEW."aplicacaoId" FOR SHARE;
  SELECT r.* INTO _r FROM "DecisaoRevisaoFinanceiraCorrecaoAula" d JOIN "PropostaRevisaoFinanceiraCorrecaoAula" r ON r.id=d."propostaId" WHERE d.id=_a."decisaoRevisaoId";
  _ef:=_r.fotografia->'efeito';
  PERFORM 1 FROM "CompraHorasAntecipadas" WHERE id=NEW."compraId" FOR UPDATE;
  IF _a.id IS NULL OR _a.efeito<>'DEVOLVE_MINUTOS' OR NEW."consumoId" IS DISTINCT FROM _ef->>'consumoId' OR NEW."compraId" IS DISTINCT FROM _ef->>'compraId'
    OR NEW.minutos IS DISTINCT FROM (_ef->>'minutos')::integer OR NEW.minutos IS DISTINCT FROM _a."minutosDevolvidos"
    OR EXISTS (SELECT 1 FROM "LiquidacaoHorasAcerto" lq WHERE lq."compraId"=NEW."compraId")
  THEN RAISE EXCEPTION 'Estorno diverge da aplicação aprovada ou a compra já foi liquidada'; END IF;
  -- Q173 (R2 do #284, B2): sem minutos de volta para compra em moeda diferente da matrícula (anterior à troca).
  IF (SELECT ch.moeda FROM "CompraHorasAntecipadas" ch WHERE ch.id=NEW."compraId") IS DISTINCT FROM (SELECT m.moeda FROM "Matricula" m JOIN "CompraHorasAntecipadas" ch ON ch."matriculaId"=m.id WHERE ch.id=NEW."compraId")
  THEN RAISE EXCEPTION 'Compra de horas na moeda anterior à troca de moeda não recebe minutos de volta'; END IF;
  RETURN NEW;
END $$;
