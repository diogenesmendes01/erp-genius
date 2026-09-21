-- 261 is immutable. PostgreSQL resolves PL/pgSQL variable names before table
-- aliases, so p.* INTO p (and equivalent e.*) is ambiguous at runtime.
-- Recreate only the materializer with disjoint source aliases and variables.
CREATE OR REPLACE FUNCTION q23_fotografia_financeira_atual_257(_proposta_id TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE proposta_registro "PropostaCorrecaoAula"%ROWTYPE; encontro_registro "EncontroAgenda"%ROWTYPE; diario_registro "AulaDiario"%ROWTYPE;
  reserva_registro "ReservaHorasCompradas"%ROWTYPE; consumo_registro "ConsumoHorasCompradas"%ROWTYPE; compra_registro "CompraHorasAntecipadas"%ROWTYPE;
  cobranca_registro "Cobranca"%ROWTYPE; ocorrencia_registro "OcorrenciaParticular"%ROWTYPE; conferencia_registro "ConferenciaOcorrenciaHoras"%ROWTYPE;
  condicoes_registro "CondicoesHorasMatricula"%ROWTYPE;
  participacao_antes TEXT; participacao_depois TEXT; quantidade_mudancas INTEGER; fonte TEXT; informes JSONB; recebimentos JSONB; destinacoes JSONB;
BEGIN
  SELECT proposta_src.* INTO proposta_registro FROM "PropostaCorrecaoAula" proposta_src WHERE proposta_src.id=_proposta_id FOR SHARE;
  IF NOT FOUND OR EXISTS (SELECT 1 FROM "RejeicaoCorrecaoAula" rejeicao_src WHERE rejeicao_src."propostaId"=proposta_registro.id)
    OR EXISTS (SELECT 1 FROM "AprovacaoCorrecaoAula" aprovacao_src WHERE aprovacao_src."propostaId"=proposta_registro.id)
    OR proposta_registro.versao IS DISTINCT FROM (SELECT max(versao) FROM "PropostaCorrecaoAula" proposta_versao WHERE proposta_versao."encontroId"=proposta_registro."encontroId") THEN RETURN NULL; END IF;
  SELECT encontro_src.* INTO encontro_registro FROM "EncontroAgenda" encontro_src WHERE encontro_src.id=proposta_registro."encontroId" FOR UPDATE;
  IF NOT FOUND OR encontro_registro."matriculaId" IS NULL THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM "ReservaHorasCompradas" reserva_existente WHERE reserva_existente."encontroId"=encontro_registro.id) THEN
    RETURN q23_fotografia_financeira_sem_reserva_261(_proposta_id);
  END IF;
  IF (SELECT count(*) FROM "ReservaHorasCompradas" reserva_contagem WHERE reserva_contagem."encontroId"=encontro_registro.id)<>1 THEN RETURN NULL; END IF;
  SELECT reserva_src.* INTO reserva_registro FROM "ReservaHorasCompradas" reserva_src WHERE reserva_src."encontroId"=encontro_registro.id FOR UPDATE;
  SELECT consumo_src.* INTO consumo_registro FROM "ConsumoHorasCompradas" consumo_src WHERE consumo_src."reservaId"=reserva_registro.id FOR UPDATE;
  SELECT compra_src.* INTO compra_registro FROM "CompraHorasAntecipadas" compra_src WHERE compra_src.id=reserva_registro."compraId" FOR UPDATE;
  SELECT diario_src.* INTO diario_registro FROM "AulaDiario" diario_src WHERE diario_src.id=proposta_registro."diarioId" FOR SHARE;
  SELECT cobranca_src.* INTO cobranca_registro FROM "Cobranca" cobranca_src WHERE cobranca_src.id=compra_registro."cobrancaId" AND cobranca_src."matriculaId"=encontro_registro."matriculaId" FOR UPDATE;
  IF consumo_registro.id IS NULL OR compra_registro.id IS NULL OR cobranca_registro.id IS NULL OR diario_registro.id IS NULL
    OR encontro_registro.finalidade::text<>'AULA' OR encontro_registro.status::text NOT IN ('PREVISTO','MINISTRADO')
    OR compra_registro."matriculaId" IS DISTINCT FROM encontro_registro."matriculaId" OR reserva_registro.inicio IS DISTINCT FROM encontro_registro.inicio
    OR reserva_registro.fim IS DISTINCT FROM encontro_registro.fim OR reserva_registro.minutos IS DISTINCT FROM extract(epoch FROM (encontro_registro.fim-encontro_registro.inicio))::integer/60
    OR EXISTS (SELECT 1 FROM "DecisaoLiberacaoHoras" liberacao_src WHERE liberacao_src."reservaId"=reserva_registro.id AND liberacao_src.aprovada) THEN RETURN NULL; END IF;
  SELECT count(*),min(anterior_src->>'participacao'),min(novo_src->>'participacao') INTO quantidade_mudancas,participacao_antes,participacao_depois
  FROM jsonb_array_elements(proposta_registro."snapshotAnterior"->'registros') anterior_src JOIN jsonb_array_elements(proposta_registro."snapshotNovo"->'registros') novo_src ON novo_src->>'registroId'=anterior_src->>'registroId'
  WHERE anterior_src->>'participacao' IS DISTINCT FROM novo_src->>'participacao';
  IF quantidade_mudancas<>1 OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(proposta_registro."snapshotAnterior"->'registros') anterior_src JOIN jsonb_array_elements(proposta_registro."snapshotNovo"->'registros') novo_src ON novo_src->>'registroId'=anterior_src->>'registroId' WHERE anterior_src->>'matriculaId'=encontro_registro."matriculaId" AND anterior_src->>'participacao' IS DISTINCT FROM novo_src->>'participacao') THEN RETURN NULL; END IF;
  IF consumo_registro."estadoDiario" IS NOT NULL THEN
    fonte:='DIARIO_REALIZADO';
    SELECT condicoes_src.* INTO condicoes_registro FROM "CondicoesHorasMatricula" condicoes_src
      WHERE condicoes_src."matriculaId"=encontro_registro."matriculaId" AND condicoes_src.status='APROVADA'
        AND (condicoes_src.regras->>'vigenteDesde')::timestamptz <= diario_registro."ocorridaEm" AT TIME ZONE 'UTC'
      ORDER BY (condicoes_src.regras->>'vigenteDesde')::timestamptz DESC, condicoes_src.versao DESC LIMIT 1 FOR SHARE;
    IF participacao_antes<>'PRESENTE' OR participacao_depois<>'FALTA' OR consumo_registro."conferenciaOcorrenciaId" IS NOT NULL
      OR condicoes_registro.id IS NULL OR condicoes_registro.regras->>'moeda' IS DISTINCT FROM compra_registro.moeda
      OR EXISTS (SELECT 1 FROM "CondicoesHorasMatricula" outra_condicao WHERE outra_condicao."matriculaId"=encontro_registro."matriculaId" AND outra_condicao.id<>condicoes_registro.id
        AND outra_condicao.status IN ('PENDENTE','APROVADA') AND (outra_condicao.regras->>'vigenteDesde')::timestamptz < encontro_registro.fim AT TIME ZONE 'UTC'
        AND (outra_condicao.status='PENDENTE' OR (outra_condicao.regras->>'vigenteDesde')::timestamptz > (condicoes_registro.regras->>'vigenteDesde')::timestamptz
          OR ((outra_condicao.regras->>'vigenteDesde')::timestamptz=(condicoes_registro.regras->>'vigenteDesde')::timestamptz AND outra_condicao.versao>condicoes_registro.versao)))
      OR consumo_registro."estadoDiario" IS DISTINCT FROM q23_estado_diario_261(diario_registro.id)
      OR diario_registro."professorId" IS DISTINCT FROM encontro_registro."professorId" OR NOT diario_registro.conteudo ~ '\S'
      OR (SELECT count(*) FROM "RegistroAulaAluno" registro_count WHERE registro_count."aulaId"=diario_registro.id)<>1
      OR NOT EXISTS (SELECT 1 FROM "RegistroAulaAluno" registro_presenca JOIN "Matricula" matricula_src ON matricula_src."alunoId"=registro_presenca."alunoId" WHERE registro_presenca."aulaId"=diario_registro.id AND matricula_src.id=encontro_registro."matriculaId" AND registro_presenca.presente IS TRUE) THEN RETURN NULL; END IF;
  ELSE
    fonte:='OCORRENCIA_Q92';
    SELECT conferencia_src.* INTO conferencia_registro FROM "ConferenciaOcorrenciaHoras" conferencia_src WHERE conferencia_src.id=consumo_registro."conferenciaOcorrenciaId" FOR UPDATE;
    SELECT ocorrencia_src.* INTO ocorrencia_registro FROM "OcorrenciaParticular" ocorrencia_src WHERE ocorrencia_src.id=conferencia_registro."ocorrenciaId" FOR SHARE;
    SELECT condicoes_src.* INTO condicoes_registro FROM "CondicoesHorasMatricula" condicoes_src WHERE condicoes_src.id=conferencia_registro."condicoesId" FOR SHARE;
    IF participacao_antes<>'FALTA' OR participacao_depois<>'PRESENTE' OR conferencia_registro.id IS NULL OR ocorrencia_registro.id IS NULL
      OR condicoes_registro.id IS NULL OR condicoes_registro.status<>'APROVADA' OR condicoes_registro."matriculaId" IS DISTINCT FROM encontro_registro."matriculaId"
      OR conferencia_registro."encontroId" IS DISTINCT FROM encontro_registro.id OR ocorrencia_registro."encontroId" IS DISTINCT FROM encontro_registro.id
      OR ocorrencia_registro."matriculaId" IS DISTINCT FROM encontro_registro."matriculaId" OR ocorrencia_registro.tipo<>'FALTA_ALUNO'
      OR conferencia_registro.desfecho<>'FALTA_COBRAVEL' OR conferencia_registro.minutos<>reserva_registro.minutos
      OR conferencia_registro."conferenteId" IS DISTINCT FROM consumo_registro."autorId"
      OR EXISTS (SELECT 1 FROM "OcorrenciaParticular" ocorrencia_posterior WHERE ocorrencia_posterior."encontroId"=encontro_registro.id AND ocorrencia_posterior.versao>ocorrencia_registro.versao) THEN RETURN NULL; END IF;
  END IF;
  PERFORM 1 FROM "PagamentoInformado" informe_lock WHERE informe_lock."cobrancaId"=cobranca_registro.id FOR SHARE;
  PERFORM 1 FROM "Recebimento" recebimento_lock WHERE recebimento_lock."cobrancaId"=cobranca_registro.id FOR SHARE;
  PERFORM 1 FROM "DestinacaoRecebimento" destinacao_lock WHERE destinacao_lock."cobrancaId"=cobranca_registro.id FOR SHARE;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',informe_src.id,'versao',informe_src.versao,'status',informe_src.status::text,'hashDados',informe_src."hashDados",'valor',informe_src.valor,'moeda',informe_src.moeda,'forma',informe_src.forma::text,'dataPagamento',informe_src."dataPagamento",'conferenteId',informe_src."conferenteId",'conferidoEm',informe_src."conferidoEm",'motivoConferencia',informe_src."motivoConferencia",'permitirExcedente',informe_src."permitirExcedente") ORDER BY informe_src.id),'[]'::jsonb) INTO informes FROM "PagamentoInformado" informe_src WHERE informe_src."cobrancaId"=cobranca_registro.id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',recebimento_src.id,'hashDados',recebimento_src."hashDados",'valor',recebimento_src.valor,'moeda',recebimento_src.moeda,'dataPagamento',recebimento_src."dataPagamento",'informeId',recebimento_src."informeId") ORDER BY recebimento_src.id),'[]'::jsonb) INTO recebimentos FROM "Recebimento" recebimento_src WHERE recebimento_src."cobrancaId"=cobranca_registro.id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',destinacao_src.id,'recebimentoId',destinacao_src."recebimentoId",'tipo',destinacao_src.tipo::text,'valor',destinacao_src.valor,'evidencia',destinacao_src.evidencia,'origemLegada',destinacao_src."origemLegada") ORDER BY destinacao_src.id),'[]'::jsonb) INTO destinacoes FROM "DestinacaoRecebimento" destinacao_src WHERE destinacao_src."cobrancaId"=cobranca_registro.id;
  RETURN jsonb_build_object('versao',3,'propostaId',proposta_registro.id,'propostaHash',proposta_registro."entradaHash",'versaoCorrecaoAula',proposta_registro.versao,'estadoHash',proposta_registro."estadoHash",
    'encontro',jsonb_build_object('id',encontro_registro.id,'matriculaId',encontro_registro."matriculaId",'finalidade',encontro_registro.finalidade::text,'status',encontro_registro.status::text,'inicio',encontro_registro.inicio,'fim',encontro_registro.fim,'professorId',encontro_registro."professorId"),
    'diario',jsonb_build_object('id',diario_registro.id,'conteudoHash',encode(digest(diario_registro.conteudo,'sha256'),'hex'),'estadoDiario',consumo_registro."estadoDiario"),
    'reservaConsumida',jsonb_build_object('id',reserva_registro.id,'minutos',reserva_registro.minutos,'inicio',reserva_registro.inicio,'fim',reserva_registro.fim,'consumoId',consumo_registro.id,'fonte',fonte,'conferenciaOcorrenciaId',consumo_registro."conferenciaOcorrenciaId"),
    'compraAntecipada',jsonb_build_object('id',compra_registro.id,'cobrancaId',compra_registro."cobrancaId",'minutosComprados',compra_registro."minutosComprados",'valorOriginal',compra_registro."valorOriginal",'descontoOriginal',compra_registro."descontoOriginal",'valorPagoAlocado',compra_registro."valorPagoAlocado",'moeda',compra_registro.moeda,'snapshot',compra_registro.snapshot,'entradaHash',compra_registro."entradaHash"),
    'cobranca',jsonb_build_object('id',cobranca_registro.id,'versao',cobranca_registro.versao,'valorNegociado',cobranca_registro."valorNegociado",'valorRecebido',cobranca_registro."valorRecebido",'saldo',cobranca_registro.saldo,'valorLiquidadoCredito',cobranca_registro."valorLiquidadoCredito",'valorCompensadoPermuta',cobranca_registro."valorCompensadoPermuta",'moeda',cobranca_registro.moeda,'status',cobranca_registro.status::text),
    'fundamento',jsonb_build_object('politica','Q92_RESERVA_CONSUMIDA_SEM_DELTA','fonte',fonte,'participacaoAnterior',participacao_antes,'participacaoProposta',participacao_depois,'minutosEquivalentes',reserva_registro.minutos,'valorPreservado',round(compra_registro."valorPagoAlocado"*reserva_registro.minutos/compra_registro."minutosComprados",2),'moeda',compra_registro.moeda),
    'condicoes',jsonb_build_object('id',condicoes_registro.id,'versao',condicoes_registro.versao,'documentoId',condicoes_registro."documentoId",'regras',condicoes_registro.regras),
    'ocorrencia',CASE WHEN ocorrencia_registro.id IS NULL THEN NULL ELSE jsonb_build_object('id',ocorrencia_registro.id,'versao',ocorrencia_registro.versao,'tipo',ocorrencia_registro.tipo) END,
    'conferencia',CASE WHEN conferencia_registro.id IS NULL THEN NULL ELSE jsonb_build_object('id',conferencia_registro.id,'minutos',conferencia_registro.minutos,'valor',conferencia_registro.valor,'moeda',conferencia_registro.moeda,'desfecho',conferencia_registro.desfecho,'snapshot',conferencia_registro.snapshot) END,
    'informesPagamento',informes,'recebimentos',recebimentos,'destinacoes',destinacoes,'semAlteracaoValores',true);
END $$;
