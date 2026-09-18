-- Q23/Q92: preserve the legacy no-reserve photograph byte-for-byte, while
-- allowing a review only for an already consumed advance reservation.
ALTER FUNCTION q23_fotografia_financeira_atual_257(TEXT) RENAME TO q23_fotografia_financeira_sem_reserva_261;

-- Same canonical bytes used by estadoDiario() in src/server/diario/estado.ts.
-- In particular, matriculaId/participacao are omitted (rather than JSON
-- null) when the source record has no matrícula. jsonb_build_object would
-- lose that distinction and could validate a claimed source hash incorrectly.
CREATE OR REPLACE FUNCTION q23_estado_diario_261(_diario_id TEXT) RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT encode(digest(
    '{"id":'||to_json(d.id)::text||
    ',"conteudo":'||to_json(d.conteudo)::text||
    -- AulaDiario uses timestamp without time zone and stores UTC. Formatting
    -- the timestamp directly is therefore stable even when the session's
    -- TimeZone is America/Sao_Paulo.
    ',"atualizadoEm":'||to_json(to_char(d."atualizadoEm",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))::text||
    ',"registros":'||coalesce((
      SELECT '['||string_agg(
        '{"alunoId":'||to_json(r."alunoId")::text||
        ',"nomeAluno":'||to_json(r."nomeAluno")::text||
        ',"presente":'||coalesce(to_json(r.presente)::text,'null')||
        ',"observacao":'||coalesce(to_json(r.observacao)::text,'null')||
        CASE WHEN r."matriculaId" IS NULL THEN '' ELSE
          ',"matriculaId":'||to_json(r."matriculaId")::text||
          ',"participacao":'||coalesce(to_json(r.participacao::text)::text,'null')
        END||'}', ',' ORDER BY r."alunoId" COLLATE "C"
      )||']' FROM "RegistroAulaAluno" r WHERE r."aulaId"=d.id
    ),'[]')||'}', 'sha256'),'hex')
  FROM "AulaDiario" d WHERE d.id=_diario_id
$$;

CREATE OR REPLACE FUNCTION q23_fotografia_financeira_atual_257(_proposta_id TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE p "PropostaCorrecaoAula"%ROWTYPE; e "EncontroAgenda"%ROWTYPE; diario "AulaDiario"%ROWTYPE;
  reserva "ReservaHorasCompradas"%ROWTYPE; consumo "ConsumoHorasCompradas"%ROWTYPE; compra "CompraHorasAntecipadas"%ROWTYPE;
  cobranca "Cobranca"%ROWTYPE; ocorrencia "OcorrenciaParticular"%ROWTYPE; conferencia "ConferenciaOcorrenciaHoras"%ROWTYPE;
  condicoes "CondicoesHorasMatricula"%ROWTYPE;
  antes TEXT; depois TEXT; mudancas INTEGER; fonte TEXT; informes JSONB; recebimentos JSONB; destinacoes JSONB;
BEGIN
  SELECT p.* INTO p FROM "PropostaCorrecaoAula" p WHERE p.id=_proposta_id FOR SHARE;
  IF NOT FOUND OR EXISTS (SELECT 1 FROM "RejeicaoCorrecaoAula" x WHERE x."propostaId"=p.id)
    OR EXISTS (SELECT 1 FROM "AprovacaoCorrecaoAula" x WHERE x."propostaId"=p.id)
    OR p.versao IS DISTINCT FROM (SELECT max(versao) FROM "PropostaCorrecaoAula" WHERE "encontroId"=p."encontroId") THEN RETURN NULL; END IF;
  SELECT e.* INTO e FROM "EncontroAgenda" e WHERE e.id=p."encontroId" FOR UPDATE;
  IF NOT FOUND OR e."matriculaId" IS NULL THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM "ReservaHorasCompradas" r WHERE r."encontroId"=e.id) THEN
    RETURN q23_fotografia_financeira_sem_reserva_261(_proposta_id);
  END IF;
  IF (SELECT count(*) FROM "ReservaHorasCompradas" r WHERE r."encontroId"=e.id)<>1 THEN RETURN NULL; END IF;
  SELECT * INTO reserva FROM "ReservaHorasCompradas" WHERE "encontroId"=e.id FOR UPDATE;
  SELECT * INTO consumo FROM "ConsumoHorasCompradas" WHERE "reservaId"=reserva.id FOR UPDATE;
  SELECT * INTO compra FROM "CompraHorasAntecipadas" WHERE id=reserva."compraId" FOR UPDATE;
  SELECT * INTO diario FROM "AulaDiario" WHERE id=p."diarioId" FOR SHARE;
  SELECT * INTO cobranca FROM "Cobranca" WHERE id=compra."cobrancaId" AND "matriculaId"=e."matriculaId" FOR UPDATE;
  IF consumo.id IS NULL OR compra.id IS NULL OR cobranca.id IS NULL OR diario.id IS NULL
    OR e.finalidade::text<>'AULA' OR e.status::text NOT IN ('PREVISTO','MINISTRADO')
    OR compra."matriculaId" IS DISTINCT FROM e."matriculaId" OR reserva.inicio IS DISTINCT FROM e.inicio
    OR reserva.fim IS DISTINCT FROM e.fim OR reserva.minutos IS DISTINCT FROM extract(epoch FROM (e.fim-e.inicio))::integer/60
    OR EXISTS (SELECT 1 FROM "DecisaoLiberacaoHoras" l WHERE l."reservaId"=reserva.id AND l.aprovada) THEN RETURN NULL; END IF;
  SELECT count(*),min(a->>'participacao'),min(n->>'participacao') INTO mudancas,antes,depois
  FROM jsonb_array_elements(p."snapshotAnterior"->'registros') a JOIN jsonb_array_elements(p."snapshotNovo"->'registros') n ON n->>'registroId'=a->>'registroId'
  WHERE a->>'participacao' IS DISTINCT FROM n->>'participacao';
  IF mudancas<>1 OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p."snapshotAnterior"->'registros') a JOIN jsonb_array_elements(p."snapshotNovo"->'registros') n ON n->>'registroId'=a->>'registroId' WHERE a->>'matriculaId'=e."matriculaId" AND a->>'participacao' IS DISTINCT FROM n->>'participacao') THEN RETURN NULL; END IF;
  IF consumo."estadoDiario" IS NOT NULL THEN
    fonte:='DIARIO_REALIZADO';
    -- A daily realization has no Q92 conference of its own. The historical
    -- approved contract conditions applicable to this interval are therefore
    -- the explicit proof that the proposed FALTA_ALUNO remains chargeable.
    SELECT * INTO condicoes FROM "CondicoesHorasMatricula" c
      WHERE c."matriculaId"=e."matriculaId" AND c.status='APROVADA'
        AND (c.regras->>'vigenteDesde')::timestamptz <= diario."ocorridaEm" AT TIME ZONE 'UTC'
      ORDER BY (c.regras->>'vigenteDesde')::timestamptz DESC, c.versao DESC LIMIT 1 FOR SHARE;
    IF antes<>'PRESENTE' OR depois<>'FALTA' OR consumo."conferenciaOcorrenciaId" IS NOT NULL
      OR condicoes.id IS NULL OR condicoes.regras->>'moeda' IS DISTINCT FROM compra.moeda
      OR EXISTS (SELECT 1 FROM "CondicoesHorasMatricula" x WHERE x."matriculaId"=e."matriculaId" AND x.id<>condicoes.id
        AND x.status IN ('PENDENTE','APROVADA') AND (x.regras->>'vigenteDesde')::timestamptz < e.fim AT TIME ZONE 'UTC'
        AND (x.status='PENDENTE' OR (x.regras->>'vigenteDesde')::timestamptz > (condicoes.regras->>'vigenteDesde')::timestamptz
          OR ((x.regras->>'vigenteDesde')::timestamptz=(condicoes.regras->>'vigenteDesde')::timestamptz AND x.versao>condicoes.versao)))
      OR consumo."estadoDiario" IS DISTINCT FROM q23_estado_diario_261(diario.id)
      OR diario."professorId" IS DISTINCT FROM e."professorId" OR NOT diario.conteudo ~ '\S'
      OR (SELECT count(*) FROM "RegistroAulaAluno" r WHERE r."aulaId"=diario.id)<>1
      OR NOT EXISTS (SELECT 1 FROM "RegistroAulaAluno" r JOIN "Matricula" m ON m."alunoId"=r."alunoId" WHERE r."aulaId"=diario.id AND m.id=e."matriculaId" AND r.presente IS TRUE) THEN RETURN NULL; END IF;
  ELSE
    fonte:='OCORRENCIA_Q92';
    SELECT * INTO conferencia FROM "ConferenciaOcorrenciaHoras" WHERE id=consumo."conferenciaOcorrenciaId" FOR UPDATE;
    SELECT * INTO ocorrencia FROM "OcorrenciaParticular" WHERE id=conferencia."ocorrenciaId" FOR SHARE;
    SELECT * INTO condicoes FROM "CondicoesHorasMatricula" WHERE id=conferencia."condicoesId" FOR SHARE;
    IF antes<>'FALTA' OR depois<>'PRESENTE' OR conferencia.id IS NULL OR ocorrencia.id IS NULL
      OR condicoes.id IS NULL OR condicoes.status<>'APROVADA' OR condicoes."matriculaId" IS DISTINCT FROM e."matriculaId"
      OR conferencia."encontroId" IS DISTINCT FROM e.id OR ocorrencia."encontroId" IS DISTINCT FROM e.id
      OR ocorrencia."matriculaId" IS DISTINCT FROM e."matriculaId" OR ocorrencia.tipo<>'FALTA_ALUNO'
      OR conferencia.desfecho<>'FALTA_COBRAVEL' OR conferencia.minutos<>reserva.minutos
      OR conferencia."conferenteId" IS DISTINCT FROM consumo."autorId"
      OR EXISTS (SELECT 1 FROM "OcorrenciaParticular" o WHERE o."encontroId"=e.id AND o.versao>ocorrencia.versao) THEN RETURN NULL; END IF;
  END IF;
  PERFORM 1 FROM "PagamentoInformado" WHERE "cobrancaId"=cobranca.id FOR SHARE;
  PERFORM 1 FROM "Recebimento" WHERE "cobrancaId"=cobranca.id FOR SHARE;
  PERFORM 1 FROM "DestinacaoRecebimento" WHERE "cobrancaId"=cobranca.id FOR SHARE;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'versao',i.versao,'status',i.status::text,'hashDados',i."hashDados",'valor',i.valor,'moeda',i.moeda,'forma',i.forma::text,'dataPagamento',i."dataPagamento",'conferenteId',i."conferenteId",'conferidoEm',i."conferidoEm",'motivoConferencia',i."motivoConferencia",'permitirExcedente',i."permitirExcedente") ORDER BY i.id),'[]'::jsonb) INTO informes FROM "PagamentoInformado" i WHERE i."cobrancaId"=cobranca.id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'hashDados',r."hashDados",'valor',r.valor,'moeda',r.moeda,'dataPagamento',r."dataPagamento",'informeId',r."informeId") ORDER BY r.id),'[]'::jsonb) INTO recebimentos FROM "Recebimento" r WHERE r."cobrancaId"=cobranca.id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',d.id,'recebimentoId',d."recebimentoId",'tipo',d.tipo::text,'valor',d.valor,'evidencia',d.evidencia,'origemLegada',d."origemLegada") ORDER BY d.id),'[]'::jsonb) INTO destinacoes FROM "DestinacaoRecebimento" d WHERE d."cobrancaId"=cobranca.id;
  RETURN jsonb_build_object('versao',3,'propostaId',p.id,'propostaHash',p."entradaHash",'versaoCorrecaoAula',p.versao,'estadoHash',p."estadoHash",
    'encontro',jsonb_build_object('id',e.id,'matriculaId',e."matriculaId",'finalidade',e.finalidade::text,'status',e.status::text,'inicio',e.inicio,'fim',e.fim,'professorId',e."professorId"),
    'diario',jsonb_build_object('id',diario.id,'conteudoHash',encode(digest(diario.conteudo,'sha256'),'hex'),'estadoDiario',consumo."estadoDiario"),
    'reservaConsumida',jsonb_build_object('id',reserva.id,'minutos',reserva.minutos,'inicio',reserva.inicio,'fim',reserva.fim,'consumoId',consumo.id,'fonte',fonte,'conferenciaOcorrenciaId',consumo."conferenciaOcorrenciaId"),
    'compraAntecipada',jsonb_build_object('id',compra.id,'cobrancaId',compra."cobrancaId",'minutosComprados',compra."minutosComprados",'valorOriginal',compra."valorOriginal",'descontoOriginal',compra."descontoOriginal",'valorPagoAlocado',compra."valorPagoAlocado",'moeda',compra.moeda,'snapshot',compra.snapshot,'entradaHash',compra."entradaHash"),
    'cobranca',jsonb_build_object('id',cobranca.id,'versao',cobranca.versao,'valorNegociado',cobranca."valorNegociado",'valorRecebido',cobranca."valorRecebido",'saldo',cobranca.saldo,'valorLiquidadoCredito',cobranca."valorLiquidadoCredito",'valorCompensadoPermuta',cobranca."valorCompensadoPermuta",'moeda',cobranca.moeda,'status',cobranca.status::text),
    'fundamento',jsonb_build_object('politica','Q92_RESERVA_CONSUMIDA_SEM_DELTA','fonte',fonte,'participacaoAnterior',antes,'participacaoProposta',depois,'minutosEquivalentes',reserva.minutos,'valorPreservado',round(compra."valorPagoAlocado"*reserva.minutos/compra."minutosComprados",2),'moeda',compra.moeda),
    'condicoes',jsonb_build_object('id',condicoes.id,'versao',condicoes.versao,'documentoId',condicoes."documentoId",'regras',condicoes.regras),
    'ocorrencia',CASE WHEN ocorrencia.id IS NULL THEN NULL ELSE jsonb_build_object('id',ocorrencia.id,'versao',ocorrencia.versao,'tipo',ocorrencia.tipo) END,
    'conferencia',CASE WHEN conferencia.id IS NULL THEN NULL ELSE jsonb_build_object('id',conferencia.id,'minutos',conferencia.minutos,'valor',conferencia.valor,'moeda',conferencia.moeda,'desfecho',conferencia.desfecho,'snapshot',conferencia.snapshot) END,
    'informesPagamento',informes,'recebimentos',recebimentos,'destinacoes',destinacoes,'semAlteracaoValores',true);
END $$;

-- The 259 validator and materializer were bound to the former function OID.
-- Recreate them after the rename so every proposal, decision and publication
-- evaluates this extended source instead of silently retaining no-reserve
-- behavior.
CREATE OR REPLACE FUNCTION q23_foto_financeira_valida_257(_proposta_id TEXT,_foto JSONB,_hash TEXT,_proposta_hash TEXT,_versao INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$ DECLARE _atual JSONB; BEGIN
  _atual:=q23_fotografia_financeira_atual_257(_proposta_id);
  RETURN _atual IS NOT NULL AND _proposta_hash=_atual->>'propostaHash' AND _versao=(_atual->>'versaoCorrecaoAula')::INTEGER
    AND _hash=q23_fotografia_hash_259(_foto) AND q23_json_canon_259(_foto)=q23_json_canon_259(_atual);
END $$;

CREATE OR REPLACE FUNCTION q23_fotografia_financeira_materializada_257(_proposta_id TEXT)
RETURNS TABLE(fotografia JSONB, "fotografiaHash" TEXT) LANGUAGE plpgsql AS $$
BEGIN
  fotografia:=q23_fotografia_financeira_atual_257(_proposta_id);
  IF fotografia IS NULL THEN RETURN; END IF;
  "fotografiaHash":=q23_fotografia_hash_259(fotografia);
  RETURN NEXT;
END $$;
