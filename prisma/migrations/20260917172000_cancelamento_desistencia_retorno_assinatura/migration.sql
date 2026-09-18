-- 247: conserva resultado de fornecedor já iniciado após conflito tardio da fonte.
-- Um envio novo continua bloqueado em PREPARADO/ENVIANDO; ENVIO_INCERTO e ENVIADO
-- preservam a resposta de uma tentativa já persistida.
CREATE OR REPLACE FUNCTION proteger_transicao_substituicao_218() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.estado='CANCELADO' AND NEW.estado<>'CANCELADO' THEN RAISE EXCEPTION 'Processo cancelado não pode ser reaberto'; END IF;
 IF TG_OP='UPDATE' AND OLD.estado<>'CANCELADO' AND NEW.estado='CANCELADO' THEN
   IF EXISTS(SELECT 1 FROM "ConclusaoAssinaturaContratual" WHERE "processoId"=OLD.id) OR NOT EXISTS(
     SELECT 1 FROM "AplicacaoSubstituicaoContratual" a JOIN "IntencaoCancelamentoAssinatura" i ON i.id=a."intencaoId" WHERE i."processoId"=OLD.id
     UNION ALL
     SELECT 1 FROM "IntencaoCancelamentoAssinatura" i JOIN "PedidoDesistenciaPreparacao" p ON p.id=i."pedidoDesistenciaId" JOIN "DecisaoAdministrativaDesistencia" d ON d.id=i."decisaoAdministrativaDesistenciaId" JOIN "ObservacaoCancelamentoAssinatura" o ON o."intencaoId"=i.id WHERE i."processoId"=OLD.id AND i."propostaId" IS NULL AND i."decisaoId" IS NULL AND i."propostaHash"=p."estadoHash" AND d.aprovada AND d."pedidoId"=p.id AND d."estadoHash"=p."estadoHash" AND d."decisorId"<>p."registradorId" AND o.resultado='CONFIRMADO' AND o."referenciaExterna"=i."referenciaExterna"
   ) THEN RAISE EXCEPTION 'Cancelamento exige aplicação de substituição ou desistência Q165 comprovada'; END IF;
 END IF;
 IF TG_OP='INSERT' AND EXISTS(SELECT 1 FROM "ProcessoAssinaturaContratual" WHERE "matriculaId"=NEW."matriculaId") THEN IF NOT EXISTS(SELECT 1 FROM "AplicacaoSubstituicaoContratual" WHERE "processoSubstitutoId"=NEW.id) THEN RAISE EXCEPTION 'Novo processo exige aplicação da substituição'; END IF; END IF;
 IF NEW.estado IN ('PREPARADO','ENVIANDO') AND fonte_assinada_substituicao_218(NEW.id) THEN RAISE EXCEPTION 'Contrato anterior assinado exige conferência Q117'; END IF;
 RETURN NEW;
END $$;

-- 247: o record PL/pgSQL p não pode compartilhar o identificador do alias SQL.
CREATE OR REPLACE FUNCTION conferir_efetivacao_pedido_desistencia_preparacao() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE a "AplicacaoAcertoDesistenciaContratual"%ROWTYPE; d "DecisaoAcertoDesistenciaContratual"%ROWTYPE; p "PropostaAcertoDesistenciaContratual"%ROWTYPE; pe "PedidoDesistenciaPreparacao"%ROWTYPE; c "CondicoesEncerramentoMatricula"%ROWTYPE; m "Matricula"%ROWTYPE; doc "Documento"%ROWTYPE; da "DecisaoAdministrativaDesistencia"%ROWTYPE; u RECORD; administrador RECORD; pedido RECORD; matricula_atual RECORD; usuario_atual RECORD; lead_atual TEXT;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Efetivação de desistência deve permanecer preservada'; END IF;
  IF NEW."aplicacaoAcertoDesistenciaContratualId" IS NULL THEN
    SELECT pedido_registro.* INTO pedido FROM "PedidoDesistenciaPreparacao" pedido_registro WHERE pedido_registro.id=NEW."pedidoId";
    IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de desistência não encontrado'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
    SELECT "leadId" INTO lead_atual FROM "Matricula" WHERE id=pedido."matriculaId";
    IF NOT FOUND THEN RAISE EXCEPTION 'Matrícula do pedido não encontrada'; END IF;
    IF lead_atual IS NOT NULL THEN PERFORM id FROM "Lead" WHERE id=lead_atual FOR UPDATE; END IF;
    SELECT * INTO matricula_atual FROM "Matricula" WHERE id=pedido."matriculaId" FOR UPDATE;
    PERFORM id FROM "PedidoDesistenciaPreparacao" WHERE id=pedido.id FOR UPDATE;
    PERFORM id FROM "ReservaVagaMatricula" WHERE "matriculaId"=pedido."matriculaId" ORDER BY id FOR UPDATE;
    PERFORM id FROM "ReservaAgendaParticular" WHERE "matriculaId"=pedido."matriculaId" ORDER BY id FOR UPDATE;
    SELECT ativo,papeis INTO usuario_atual FROM "Usuario" WHERE id=NEW."executorId" FOR SHARE;
    IF usuario_atual.ativo IS DISTINCT FROM true OR NOT ('SECRETARIA_ACADEMICA'=ANY(usuario_atual.papeis) OR 'ADMINISTRADOR'=ANY(usuario_atual.papeis)) THEN RAISE EXCEPTION 'Efetivação exige Secretaria ou Administração ativa'; END IF;
    IF NEW."matriculaId" IS DISTINCT FROM pedido."matriculaId" OR NEW."estadoHash" IS DISTINCT FROM pedido."estadoHash" THEN RAISE EXCEPTION 'Efetivação não corresponde ao pedido conferido'; END IF;
    IF matricula_atual.status NOT IN('RASCUNHO','AGUARDANDO') OR matricula_atual."ativadaEm" IS NOT NULL OR matricula_atual."contratoOk" OR matricula_atual."confirmacaoContratoEm" IS NOT NULL OR matricula_atual."contratoDocumentoId" IS NOT NULL THEN RAISE EXCEPTION 'Efetivação exige matrícula ainda em preparação'; END IF;
    IF EXISTS(SELECT 1 FROM "PedidoDesistenciaPreparacao" x WHERE x."matriculaId"=pedido."matriculaId" AND x.versao>pedido.versao) THEN RAISE EXCEPTION 'Há pedido de desistência mais recente'; END IF;
    IF pedido."snapshotJson"->'matricula'->>'status' IS DISTINCT FROM matricula_atual.status::text OR pedido."snapshotJson"->'matricula'->>'leadId' IS DISTINCT FROM lead_atual OR (pedido."snapshotJson"->'matricula'->>'ativadaEm') IS DISTINCT FROM (CASE WHEN matricula_atual."ativadaEm" IS NULL THEN NULL ELSE to_char(matricula_atual."ativadaEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END) OR (pedido."snapshotJson"->'matricula'->>'contratoOk') IS DISTINCT FROM (CASE WHEN matricula_atual."contratoOk" THEN 'true' ELSE 'false' END) OR (pedido."snapshotJson"->'matricula'->>'confirmacaoContratoEm') IS DISTINCT FROM (CASE WHEN matricula_atual."confirmacaoContratoEm" IS NULL THEN NULL ELSE to_char(matricula_atual."confirmacaoContratoEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END) OR pedido."snapshotJson"->'matricula'->>'contratoDocumentoId' IS DISTINCT FROM matricula_atual."contratoDocumentoId" THEN RAISE EXCEPTION 'A fonte da matrícula mudou desde a conferência'; END IF;
    IF (pedido."snapshotJson"->'preparacao'='null'::jsonb) IS DISTINCT FROM (NOT EXISTS(SELECT 1 FROM "PreparacaoComercialMatricula" WHERE "matriculaId"=pedido."matriculaId")) OR EXISTS(SELECT 1 FROM "PreparacaoComercialMatricula" pc WHERE pc."matriculaId"=pedido."matriculaId" AND (pedido."snapshotJson"->'preparacao'->>'id' IS DISTINCT FROM pc.id OR pedido."snapshotJson"->'preparacao'->>'reservaId' IS DISTINCT FROM pc."reservaId" OR pedido."snapshotJson"->'preparacao'->>'reservaParticularId' IS DISTINCT FROM pc."reservaParticularId" OR pedido."snapshotJson"->'preparacao'->>'regime' IS DISTINCT FROM pc.regime::text OR pedido."snapshotJson"->'preparacao'->>'entradaHash' IS DISTINCT FROM pc."entradaHash")) THEN RAISE EXCEPTION 'A preparação comercial mudou desde a conferência'; END IF;
    IF jsonb_array_length(COALESCE(pedido."snapshotJson"->'condicoes','[]'::jsonb))<>(SELECT count(*) FROM "CondicoesEntradaPreparacao" WHERE "matriculaId"=pedido."matriculaId") OR EXISTS(SELECT 1 FROM "CondicoesEntradaPreparacao" cc WHERE cc."matriculaId"=pedido."matriculaId" AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'condicoes') s WHERE s->>'id'=cc.id AND (s->>'versao')::integer=cc.versao AND s->>'entradaHash'=cc."entradaHash")) THEN RAISE EXCEPTION 'As condições de preparação mudaram desde a conferência'; END IF;
    IF jsonb_array_length(COALESCE(pedido."snapshotJson"->'reservasColetivas','[]'::jsonb))<>(SELECT count(*) FROM "ReservaVagaMatricula" WHERE "matriculaId"=pedido."matriculaId") OR EXISTS(SELECT 1 FROM "ReservaVagaMatricula" r WHERE r."matriculaId"=pedido."matriculaId" AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'reservasColetivas') s WHERE s->>'id'=r.id AND s->>'turmaId'=r."turmaId" AND s->>'janelaId'=r."janelaId" AND s->>'status'=r.status::text AND (s->>'expiraEm')::timestamptz AT TIME ZONE 'UTC'=r."expiraEm" AND s->>'entradaHash'=r."entradaHash")) THEN RAISE EXCEPTION 'A reserva coletiva mudou desde a conferência'; END IF;
    IF jsonb_array_length(COALESCE(pedido."snapshotJson"->'reservasParticulares','[]'::jsonb))<>(SELECT count(*) FROM "ReservaAgendaParticular" WHERE "matriculaId"=pedido."matriculaId") OR EXISTS(SELECT 1 FROM "ReservaAgendaParticular" r WHERE r."matriculaId"=pedido."matriculaId" AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'reservasParticulares') s WHERE s->>'id'=r.id AND s->>'status'=r.status::text AND (s->>'expiraEm')::timestamptz AT TIME ZONE 'UTC'=r."expiraEm" AND s->>'entradaHash'=r."entradaHash")) OR EXISTS(SELECT 1 FROM "HorarioReservaParticular" h JOIN "ReservaAgendaParticular" r ON r.id=h."reservaId" WHERE r."matriculaId"=pedido."matriculaId" AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'reservasParticulares') s,jsonb_array_elements(s->'horarios') hjson WHERE s->>'id'=r.id AND hjson->>'id'=h.id AND hjson->>'professorId'=h."professorId" AND hjson->>'fusoOrigem'=h."fusoOrigem" AND (hjson->>'inicio')::timestamptz AT TIME ZONE 'UTC'=h.inicio AND (hjson->>'fim')::timestamptz AT TIME ZONE 'UTC'=h.fim)) THEN RAISE EXCEPTION 'A reserva particular mudou desde a conferência'; END IF;
    IF (NEW."decisaoFinanceiraId" IS NULL AND EXISTS(SELECT 1 FROM "Cobranca" WHERE "matriculaId"=pedido."matriculaId")) OR EXISTS(SELECT 1 FROM "CreditoMatricula" WHERE "matriculaId"=pedido."matriculaId") OR EXISTS(SELECT 1 FROM "ProcessoAssinaturaContratual" WHERE "matriculaId"=pedido."matriculaId") OR EXISTS(SELECT 1 FROM "Documento" WHERE "matriculaId"=pedido."matriculaId") OR EXISTS(SELECT 1 FROM "AlocacaoTurma" WHERE "matriculaId"=pedido."matriculaId") THEN RAISE EXCEPTION 'Efetivação simples exige ausência de avanço financeiro, documental, assinatura e alocação'; END IF;
    IF EXISTS(SELECT 1 FROM "ReservaVagaMatricula" WHERE "matriculaId"=pedido."matriculaId" AND status='UTILIZADA') OR EXISTS(SELECT 1 FROM "ReservaAgendaParticular" WHERE "matriculaId"=pedido."matriculaId" AND status='UTILIZADA') THEN RAISE EXCEPTION 'Reserva utilizada exige fluxo de acerto'; END IF;
    IF EXISTS(SELECT 1 FROM "ReservaVagaMatricula" WHERE "matriculaId"=pedido."matriculaId" AND status NOT IN('ATIVA','MANTIDA_PENDENCIA','EXPIRADA','LIBERADA')) OR EXISTS(SELECT 1 FROM "ReservaAgendaParticular" WHERE "matriculaId"=pedido."matriculaId" AND status NOT IN('ATIVA','MANTIDA_PENDENCIA','EXPIRADA','LIBERADA')) THEN RAISE EXCEPTION 'Estado de reserva incompatível com a efetivação'; END IF;
    IF NEW."decisaoFinanceiraId" IS NOT NULL THEN PERFORM validar_aprovacao_financeira_desistencia(NEW."decisaoFinanceiraId",NEW."pedidoId",NEW."estadoHash"); END IF;
    RETURN NEW;
  END IF;
  IF NEW."decisaoFinanceiraId" IS NOT NULL THEN RAISE EXCEPTION 'Efetivação Q165 deve ser uma inserção contratual exclusiva'; END IF;
  SELECT * INTO a FROM "AplicacaoAcertoDesistenciaContratual" WHERE id=NEW."aplicacaoAcertoDesistenciaContratualId" FOR SHARE;
  SELECT * INTO d FROM "DecisaoAcertoDesistenciaContratual" WHERE id=a."decisaoId" FOR SHARE;
  SELECT * INTO p FROM "PropostaAcertoDesistenciaContratual" WHERE id=d."propostaId" FOR UPDATE;
  SELECT * INTO pe FROM "PedidoDesistenciaPreparacao" WHERE id=p."pedidoId" FOR UPDATE;
  SELECT * INTO c FROM "CondicoesEncerramentoMatricula" WHERE id=p."condicoesId" FOR SHARE;
  SELECT * INTO m FROM "Matricula" WHERE id=pe."matriculaId" FOR UPDATE;
  SELECT * INTO doc FROM "Documento" WHERE id=c."documentoId" FOR SHARE;
  SELECT * INTO da FROM "DecisaoAdministrativaDesistencia" WHERE "pedidoId"=pe.id FOR SHARE;
  SELECT ativo,papeis INTO administrador FROM "Usuario" WHERE id=da."decisorId" FOR SHARE;
  SELECT ativo,papeis INTO u FROM "Usuario" WHERE id=NEW."executorId" FOR SHARE;
  PERFORM id FROM "Cobranca" WHERE "matriculaId"=pe."matriculaId" ORDER BY id FOR UPDATE;
  PERFORM id FROM "ProcessoAssinaturaContratual" WHERE "matriculaId"=pe."matriculaId" ORDER BY id FOR UPDATE;
  IF a.id IS NULL OR d.id IS NULL OR p.id IS NULL OR pe.id IS NULL OR c.id IS NULL OR m.id IS NULL
    OR NOT d.aprovada OR a."condicoesHash" IS DISTINCT FROM p."condicoesHash" OR a."fotografiaHash" IS DISTINCT FROM p."fotografiaHash" OR a.memoria IS DISTINCT FROM p.memoria
    OR da.id IS NULL OR NOT da.aprovada OR da."estadoHash" IS DISTINCT FROM pe."estadoHash" OR da."decisorId" IS NOT DISTINCT FROM pe."registradorId"
    OR administrador.ativo IS DISTINCT FROM true OR NOT ('ADMINISTRADOR'=ANY(administrador.papeis))
    OR NEW."pedidoId" IS DISTINCT FROM pe.id OR NEW."matriculaId" IS DISTINCT FROM pe."matriculaId" OR NEW."estadoHash" IS DISTINCT FROM pe."estadoHash"
    OR u.ativo IS DISTINCT FROM true OR NOT ('SECRETARIA_ACADEMICA'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis))
    OR m.status NOT IN ('RASCUNHO','AGUARDANDO') OR m."ativadaEm" IS NOT NULL OR c.status<>'APROVADA' OR c."matriculaId" IS DISTINCT FROM m.id OR NOT q165_fonte_condicoes_valida(c.id,true)
    OR EXISTS(SELECT 1 FROM "PedidoDesistenciaPreparacao" x WHERE x."matriculaId"=m.id AND x.versao>pe.versao)
    OR EXISTS(SELECT 1 FROM "CondicoesEncerramentoMatricula" x WHERE x."matriculaId"=m.id AND x.versao>c.versao)
    OR EXISTS(SELECT 1 FROM "ProcessoAssinaturaContratual" processo WHERE processo."matriculaId"=m.id
      AND NOT EXISTS(SELECT 1 FROM "ConclusaoAssinaturaContratual" conclusao WHERE conclusao."processoId"=processo.id)
      AND NOT q165_cancelamento_desistencia_comprovado(processo.id) AND NOT EXISTS(
        SELECT 1
        FROM "IntencaoCancelamentoAssinatura" intencao
        JOIN "PropostaSubstituicaoContratual" proposta_substituicao ON proposta_substituicao.id=intencao."propostaId"
        JOIN "DecisaoSubstituicaoContratual" decisao_substituicao ON decisao_substituicao.id=intencao."decisaoId"
        JOIN "AplicacaoSubstituicaoContratual" aplicacao_substituicao ON aplicacao_substituicao."intencaoId"=intencao.id
        JOIN "ObservacaoCancelamentoAssinatura" observacao ON observacao.id=aplicacao_substituicao."observacaoId"
        WHERE processo.estado='CANCELADO'
          AND intencao."processoId"=processo.id AND intencao."referenciaExterna"=processo."referenciaExterna"
          AND proposta_substituicao."processoFonteId"=processo.id AND proposta_substituicao."matriculaId"=m.id
          AND intencao."propostaHash"=proposta_substituicao."entradaHash"
          AND decisao_substituicao."propostaId"=proposta_substituicao.id AND decisao_substituicao.aprovada
          AND decisao_substituicao."decisorId" IS DISTINCT FROM proposta_substituicao."preparadaPorId"
          AND decisao_substituicao."propostaHash"=proposta_substituicao."entradaHash"
          AND aplicacao_substituicao."propostaHash"=intencao."propostaHash"
          AND observacao."intencaoId"=intencao.id AND observacao.resultado='CONFIRMADO'
          AND observacao."referenciaExterna"=intencao."referenciaExterna"))
    OR EXISTS(SELECT 1 FROM "EfetivacaoPedidoDesistenciaPreparacao" x WHERE x."matriculaId"=m.id) THEN
    RAISE EXCEPTION 'Efetivação Q165 não corresponde ao pedido, contrato e aplicação aprovados';
  END IF;
  PERFORM q165_validar_efeitos_aplicacao(a.id);
  RETURN NEW;
END $$;
