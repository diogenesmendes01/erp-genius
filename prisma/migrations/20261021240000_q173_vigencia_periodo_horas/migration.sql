-- Q173, R3 do #284 (B4): troca com vigência no meio de um período de fechamento de horas. Opção conservadora: a
-- matrícula com condições de horas só troca de moeda com a vigência no início de um período mensal (dia 1, 00:00 no
-- fuso da escola). A apuração (carregarApuracaoHorasTx) passa a comparar a conferência já destinada com a moeda
-- vigente na data da aula, para o mês anterior à vigência continuar apurável.
-- pendencias_moeda_antiga_173 redefinida a partir da definição vigente (20261021230000), conferida por diff -w: só o
-- ramo VIGENCIA_NO_MEIO_DO_PERIODO_HORAS. Como na 220000/230000, as tabelas da Q171 nascem depois deste range.
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
    -- R3 do #284, B4: em matrícula por hora, o fechamento é mensal. Uma vigência no meio do período misturaria aulas
    -- na moeda anterior e na nova no mesmo fechamento. Exige-se a vigência às 00:00 do dia 1 no fuso da escola, nenhum
    -- fechamento já registrado atravessando a vigência e nenhum fechamento por ciclo que não comece no dia 1.
    UNION ALL SELECT 'VIGENCIA_NO_MEIO_DO_PERIODO_HORAS' WHERE EXISTS (SELECT 1 FROM "CondicoesHorasMatricula" ch WHERE ch."matriculaId"=matricula_id)
      AND (((vigencia AT TIME ZONE 'UTC') AT TIME ZONE fuso) <> date_trunc('month', (vigencia AT TIME ZONE 'UTC') AT TIME ZONE fuso)
        OR EXISTS (SELECT 1 FROM "RascunhoFechamentoHoras" rf WHERE rf."matriculaId"=matricula_id AND rf."periodoInicio" < vigencia AND rf."periodoFimExclusivo" > vigencia)
        OR EXISTS (SELECT 1 FROM "RascunhoFechamentoHoras" rf WHERE rf."matriculaId"=matricula_id
          AND rf.entrada->'periodo'->'referencia'->>'referencia'='CICLO_MATRICULA' AND right(rf.entrada->'periodo'->'referencia'->>'dataReferencia', 2)<>'01'))
  ) pendencias
$$;

RESET check_function_bodies;
