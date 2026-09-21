-- Q246: acerto de desistência antes da ativação pode usar o original já enviado,
-- sem transformar esse original em contrato aceito. O cancelamento Q121 encerra
-- esse envio com a decisão administrativa já aprovada, sem criar substituto.
BEGIN;

ALTER TABLE "CondicoesEncerramentoMatricula" ALTER COLUMN "documentoId" DROP NOT NULL;
ALTER TABLE "CondicoesEncerramentoMatricula"
  ADD COLUMN "artefatoContratualId" TEXT,
  ADD COLUMN "processoAssinaturaId" TEXT,
  ADD CONSTRAINT "CondicoesEncerramentoMatricula_artefato_fkey" FOREIGN KEY ("artefatoContratualId") REFERENCES "ArtefatoContratual"(id) ON DELETE RESTRICT,
  ADD CONSTRAINT "CondicoesEncerramentoMatricula_processo_fkey" FOREIGN KEY ("processoAssinaturaId") REFERENCES "ProcessoAssinaturaContratual"(id) ON DELETE RESTRICT,
  ADD CONSTRAINT "CondicoesEncerramentoMatricula_fonte_check" CHECK (
    ("documentoId" IS NOT NULL AND "artefatoContratualId" IS NULL AND "processoAssinaturaId" IS NULL)
    OR ("documentoId" IS NULL AND "artefatoContratualId" IS NOT NULL AND "processoAssinaturaId" IS NOT NULL)
  );
CREATE INDEX "CondicoesEncerramentoMatricula_artefatoContratualId_idx" ON "CondicoesEncerramentoMatricula"("artefatoContratualId");
CREATE INDEX "CondicoesEncerramentoMatricula_processoAssinaturaId_idx" ON "CondicoesEncerramentoMatricula"("processoAssinaturaId");

ALTER TABLE "IntencaoCancelamentoAssinatura" ALTER COLUMN "propostaId" DROP NOT NULL;
ALTER TABLE "IntencaoCancelamentoAssinatura" ALTER COLUMN "decisaoId" DROP NOT NULL;
ALTER TABLE "IntencaoCancelamentoAssinatura"
  ADD COLUMN "pedidoDesistenciaId" TEXT,
  ADD COLUMN "decisaoAdministrativaDesistenciaId" TEXT,
  ADD CONSTRAINT "IntencaoCancelamentoAssinatura_pedidoDesistencia_fkey" FOREIGN KEY ("pedidoDesistenciaId") REFERENCES "PedidoDesistenciaPreparacao"(id) ON DELETE RESTRICT,
  ADD CONSTRAINT "IntencaoCancelamentoAssinatura_decisaoAdministrativaDesistencia_fkey" FOREIGN KEY ("decisaoAdministrativaDesistenciaId") REFERENCES "DecisaoAdministrativaDesistencia"(id) ON DELETE RESTRICT,
  ADD CONSTRAINT "IntencaoCancelamentoAssinatura_origem_check" CHECK (
    ("propostaId" IS NOT NULL AND "decisaoId" IS NOT NULL AND "pedidoDesistenciaId" IS NULL AND "decisaoAdministrativaDesistenciaId" IS NULL)
    OR ("propostaId" IS NULL AND "decisaoId" IS NULL AND "pedidoDesistenciaId" IS NOT NULL AND "decisaoAdministrativaDesistenciaId" IS NOT NULL)
  );
CREATE INDEX "IntencaoCancelamentoAssinatura_pedidoDesistenciaId_idx" ON "IntencaoCancelamentoAssinatura"("pedidoDesistenciaId");
CREATE INDEX "IntencaoCancelamentoAssinatura_decisaoAdministrativaDesistenciaId_idx" ON "IntencaoCancelamentoAssinatura"("decisaoAdministrativaDesistenciaId");

CREATE FUNCTION q165_cancelamento_desistencia_comprovado(processo_id TEXT) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "ProcessoAssinaturaContratual" ps
    JOIN "IntencaoCancelamentoAssinatura" i ON i."processoId"=ps.id
    JOIN "PedidoDesistenciaPreparacao" pe ON pe.id=i."pedidoDesistenciaId"
    JOIN "DecisaoAdministrativaDesistencia" da ON da.id=i."decisaoAdministrativaDesistenciaId" AND da."pedidoId"=pe.id
    JOIN "Usuario" u ON u.id=da."decisorId"
    JOIN "DecisaoAcertoDesistenciaContratual" df ON df.aprovada
    JOIN "PropostaAcertoDesistenciaContratual" pf ON pf.id=df."propostaId" AND pf."pedidoId"=pe.id
    JOIN "AplicacaoAcertoDesistenciaContratual" a ON a."decisaoId"=df.id
    JOIN "ObservacaoCancelamentoAssinatura" o ON o."intencaoId"=i.id
    WHERE ps.id=processo_id AND ps.estado='CANCELADO' AND ps."referenciaExterna" IS NOT NULL
      AND i."propostaId" IS NULL AND i."decisaoId" IS NULL AND i."propostaHash"=pe."estadoHash"
      AND da.aprovada AND da."estadoHash"=pe."estadoHash" AND da."decisorId"<>pe."registradorId"
      AND u.ativo AND 'ADMINISTRADOR'=ANY(u.papeis) AND o.resultado='CONFIRMADO'
      AND o."referenciaExterna"=ps."referenciaExterna"
  )
$$;

CREATE OR REPLACE FUNCTION q165_fonte_condicoes_valida(condicoes_id TEXT, permitir_cancelado BOOLEAN DEFAULT false) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM "CondicoesEncerramentoMatricula" c JOIN "Matricula" m ON m.id=c."matriculaId"
    JOIN "Documento" doc ON doc.id=c."documentoId"
    WHERE c.id=condicoes_id AND c."artefatoContratualId" IS NULL AND c."processoAssinaturaId" IS NULL
      AND m."contratoOk" AND m."confirmacaoContratoEm" IS NOT NULL AND m."confirmacaoContratoPorId" IS NOT NULL
      AND c."documentoId"=m."contratoDocumentoId" AND doc."matriculaId"=m.id AND NOT doc.arquivado
  ) OR EXISTS (
    SELECT 1 FROM "CondicoesEncerramentoMatricula" c JOIN "Matricula" m ON m.id=c."matriculaId"
    JOIN "ArtefatoContratual" a ON a.id=c."artefatoContratualId"
    JOIN "PreviaDocumentoContratual" pr ON pr.id=a."previaId"
    JOIN "ProcessoAssinaturaContratual" ps ON ps.id=c."processoAssinaturaId"
    JOIN "ConferenciaAssinaturaContratual" ca ON ca.id=ps."conferenciaId" AND ca."artefatoId"=a.id
    WHERE c.id=condicoes_id AND c."documentoId" IS NULL AND ps."matriculaId"=m.id AND ps."artefatoId"=a.id
      AND pr."matriculaId"=m.id AND m.status IN ('RASCUNHO','AGUARDANDO') AND m."ativadaEm" IS NULL
      AND c.regras ? 'acertoDesistenciaPreparacao'
      AND ((ps.estado='ENVIADO' AND ps."referenciaExterna" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "ConclusaoAssinaturaContratual" x WHERE x."processoId"=ps.id))
        OR (permitir_cancelado AND ps.estado='CANCELADO' AND q165_cancelamento_desistencia_comprovado(ps.id)))
  )
$$;

CREATE OR REPLACE FUNCTION q165_contexto(proposta_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE p "PropostaAcertoDesistenciaContratual"%ROWTYPE; pe "PedidoDesistenciaPreparacao"%ROWTYPE; c "CondicoesEncerramentoMatricula"%ROWTYPE; m "Matricula"%ROWTYPE;
BEGIN
 SELECT * INTO p FROM "PropostaAcertoDesistenciaContratual" WHERE id=proposta_id FOR UPDATE;
 SELECT * INTO pe FROM "PedidoDesistenciaPreparacao" WHERE id=p."pedidoId" FOR UPDATE;
 SELECT * INTO c FROM "CondicoesEncerramentoMatricula" WHERE id=p."condicoesId" FOR SHARE;
 SELECT * INTO m FROM "Matricula" WHERE id=pe."matriculaId" FOR UPDATE;
 PERFORM id FROM "Cobranca" WHERE "matriculaId"=pe."matriculaId" ORDER BY id FOR UPDATE;
 IF p.id IS NULL OR pe.id IS NULL OR c.id IS NULL OR m.id IS NULL OR p."estadoHash" IS DISTINCT FROM pe."estadoHash"
    OR c."matriculaId" IS DISTINCT FROM pe."matriculaId" OR c.status<>'APROVADA' OR NOT q165_regra_valida(c.regras)
    OR NOT q165_fonte_condicoes_valida(c.id) OR EXISTS(SELECT 1 FROM "CondicoesEncerramentoMatricula" x WHERE x."matriculaId"=c."matriculaId" AND x.versao>c.versao)
    OR m.status NOT IN ('RASCUNHO','AGUARDANDO') OR m."ativadaEm" IS NOT NULL
    OR EXISTS(SELECT 1 FROM "PedidoDesistenciaPreparacao" x WHERE x."matriculaId"=pe."matriculaId" AND x.versao>pe.versao)
    OR EXISTS(SELECT 1 FROM "EfetivacaoPedidoDesistenciaPreparacao" x WHERE x."matriculaId"=pe."matriculaId") THEN
   RAISE EXCEPTION 'Pedido, fonte contratual ou matrícula não correspondem ao acerto';
 END IF;
 PERFORM q165_fotografia_atual(p.id);
 IF EXISTS(SELECT 1 FROM "Cobranca" x WHERE x."matriculaId"=pe."matriculaId" AND coalesce(x."valorCompensadoPermuta",0)<>0) THEN RAISE EXCEPTION 'Permuta exige destinação negociada própria'; END IF;
END $$;

CREATE OR REPLACE FUNCTION q165_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE p "PropostaAcertoDesistenciaContratual"%ROWTYPE; d "DecisaoAcertoDesistenciaContratual"%ROWTYPE; regras JSONB; pe "PedidoDesistenciaPreparacao"%ROWTYPE; da "DecisaoAdministrativaDesistencia"%ROWTYPE; u RECORD;
BEGIN
 IF TG_TABLE_NAME='PropostaAcertoDesistenciaContratual' THEN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Proposta é imutável'; END IF;
  SELECT c.regras INTO regras FROM "CondicoesEncerramentoMatricula" c WHERE c.id=NEW."condicoesId" FOR SHARE;
  IF NEW."condicoesHash" IS DISTINCT FROM encode(digest(q165_json_canon(regras),'sha256'),'hex') OR NEW."fotografiaHash" IS DISTINCT FROM encode(digest(q165_json_canon(NEW.memoria->'fotografia'),'sha256'),'hex') THEN RAISE EXCEPTION 'Hashes Q165 não comprovam a memória canônica'; END IF;
  PERFORM q165_autorizado(NEW."preparadorId",false); PERFORM q165_contexto(NEW.id);
  IF EXISTS(SELECT 1 FROM "AplicacaoAcertoDesistenciaContratual" a JOIN "DecisaoAcertoDesistenciaContratual" x ON x.id=a."decisaoId" JOIN "PropostaAcertoDesistenciaContratual" anterior ON anterior.id=x."propostaId" WHERE anterior."pedidoId"=NEW."pedidoId") THEN RAISE EXCEPTION 'Este pedido já possui aplicação Q165 pendente de efetivação.'; END IF;
  PERFORM q165_memoria(NEW.id); RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='DecisaoAcertoDesistenciaContratual' THEN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Decisão é imutável'; END IF;
  SELECT * INTO p FROM "PropostaAcertoDesistenciaContratual" WHERE id=NEW."propostaId" FOR UPDATE;
  IF p.id IS NULL OR p."preparadorId"=NEW."decisorId" OR NEW."condicoesHash" IS DISTINCT FROM p."condicoesHash" OR NEW."fotografiaHash" IS DISTINCT FROM p."fotografiaHash" THEN RAISE EXCEPTION 'Decisão não corresponde à proposta independente'; END IF;
  PERFORM q165_autorizado(NEW."decisorId",true); IF NEW.aprovada THEN PERFORM q165_contexto(p.id); PERFORM q165_memoria(p.id); END IF; RETURN NEW;
 END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Aplicação é imutável'; END IF;
 SELECT * INTO d FROM "DecisaoAcertoDesistenciaContratual" WHERE id=NEW."decisaoId" FOR SHARE; SELECT * INTO p FROM "PropostaAcertoDesistenciaContratual" WHERE id=d."propostaId" FOR UPDATE; SELECT * INTO pe FROM "PedidoDesistenciaPreparacao" WHERE id=p."pedidoId" FOR SHARE; SELECT * INTO da FROM "DecisaoAdministrativaDesistencia" WHERE "pedidoId"=pe.id FOR SHARE; SELECT ativo,papeis INTO u FROM "Usuario" WHERE id=da."decisorId" FOR SHARE;
 IF d.id IS NULL OR p.id IS NULL OR NOT d.aprovada OR NEW."executorId" IS DISTINCT FROM d."decisorId" OR NEW."condicoesHash" IS DISTINCT FROM p."condicoesHash" OR NEW."fotografiaHash" IS DISTINCT FROM p."fotografiaHash" OR NEW.memoria IS DISTINCT FROM p.memoria OR da.id IS NULL OR NOT da.aprovada OR da."estadoHash" IS DISTINCT FROM p."estadoHash" OR da."decisorId"=pe."registradorId" OR u.ativo IS NOT TRUE OR NOT ('ADMINISTRADOR'=ANY(u.papeis)) THEN RAISE EXCEPTION 'Aplicação Q165 exige decisões financeira e administrativa aprovadas, independentes e vinculadas ao pedido'; END IF;
 PERFORM q165_autorizado(NEW."executorId",true); PERFORM q165_contexto(p.id);
 IF EXISTS(SELECT 1 FROM "AplicacaoAcertoDesistenciaContratual" a JOIN "DecisaoAcertoDesistenciaContratual" x ON x.id=a."decisaoId" JOIN "PropostaAcertoDesistenciaContratual" anterior ON anterior.id=x."propostaId" WHERE anterior."pedidoId"=p."pedidoId") THEN RAISE EXCEPTION 'Este pedido já possui aplicação Q165 pendente de efetivação.'; END IF;
 PERFORM q165_memoria(p.id); RETURN NEW;
END $$;



CREATE OR REPLACE FUNCTION conferir_efetivacao_pedido_desistencia_preparacao() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE a "AplicacaoAcertoDesistenciaContratual"%ROWTYPE; d "DecisaoAcertoDesistenciaContratual"%ROWTYPE; p "PropostaAcertoDesistenciaContratual"%ROWTYPE; pe "PedidoDesistenciaPreparacao"%ROWTYPE; c "CondicoesEncerramentoMatricula"%ROWTYPE; m "Matricula"%ROWTYPE; doc "Documento"%ROWTYPE; da "DecisaoAdministrativaDesistencia"%ROWTYPE; u RECORD; administrador RECORD; pedido RECORD; matricula_atual RECORD; usuario_atual RECORD; lead_atual TEXT;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Efetivação de desistência deve permanecer preservada'; END IF;
  IF NEW."aplicacaoAcertoDesistenciaContratualId" IS NULL THEN
    SELECT p.* INTO pedido FROM "PedidoDesistenciaPreparacao" p WHERE p.id=NEW."pedidoId";
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


CREATE OR REPLACE FUNCTION validar_intencao_cancelamento_217() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE processo "ProcessoAssinaturaContratual"%ROWTYPE; proposta "PropostaSubstituicaoContratual"%ROWTYPE; decisao "DecisaoSubstituicaoContratual"%ROWTYPE; pedido "PedidoDesistenciaPreparacao"%ROWTYPE; administrativa "DecisaoAdministrativaDesistencia"%ROWTYPE; ator "Usuario"%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Intenção de cancelamento é imutável'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO processo FROM "ProcessoAssinaturaContratual" WHERE id=NEW."processoId" FOR UPDATE;
 SELECT * INTO ator FROM "Usuario" WHERE id=NEW."executorId" FOR SHARE;
 IF processo.id IS NULL OR NOT ator.ativo OR NOT(ator.papeis && ARRAY['SECRETARIA_ACADEMICA','ADMINISTRADOR']::"Papel"[]) OR processo.estado<>'ENVIADO' OR processo."referenciaExterna" IS NULL OR EXISTS(SELECT 1 FROM "ConclusaoAssinaturaContratual" WHERE "processoId"=processo.id) THEN RAISE EXCEPTION 'Cancelamento exige Secretaria ou Administração ativa e envio externo aberto'; END IF;
 IF NEW."propostaId" IS NOT NULL THEN
   SELECT * INTO proposta FROM "PropostaSubstituicaoContratual" WHERE id=NEW."propostaId"; SELECT * INTO decisao FROM "DecisaoSubstituicaoContratual" WHERE id=NEW."decisaoId";
   IF NEW."pedidoDesistenciaId" IS NOT NULL OR NEW."decisaoAdministrativaDesistenciaId" IS NOT NULL OR proposta.id IS NULL OR decisao.id IS NULL OR proposta."processoFonteId"<>processo.id OR proposta."matriculaId"<>processo."matriculaId" OR NEW."propostaHash"<>proposta."entradaHash" OR NEW."referenciaExterna"<>processo."referenciaExterna" OR NOT decisao.aprovada OR decisao."propostaId"<>proposta.id OR decisao."decisorId"=proposta."preparadaPorId" OR decisao."propostaHash"<>proposta."entradaHash" THEN RAISE EXCEPTION 'Intenção de substituição não corresponde à proposta aprovada'; END IF;
 ELSE
   SELECT * INTO pedido FROM "PedidoDesistenciaPreparacao" WHERE id=NEW."pedidoDesistenciaId"; SELECT * INTO administrativa FROM "DecisaoAdministrativaDesistencia" WHERE id=NEW."decisaoAdministrativaDesistenciaId";
   IF NEW."decisaoId" IS NOT NULL OR pedido.id IS NULL OR administrativa.id IS NULL OR pedido."matriculaId"<>processo."matriculaId" OR administrativa."pedidoId"<>pedido.id OR NOT administrativa.aprovada OR administrativa."estadoHash"<>pedido."estadoHash" OR administrativa."decisorId"=pedido."registradorId" OR NEW."propostaHash"<>pedido."estadoHash" OR NEW."referenciaExterna"<>processo."referenciaExterna" OR NOT EXISTS(SELECT 1 FROM "Usuario" u WHERE u.id=administrativa."decisorId" AND u.ativo AND 'ADMINISTRADOR'=ANY(u.papeis)) OR NOT EXISTS(SELECT 1 FROM "AplicacaoAcertoDesistenciaContratual" a JOIN "DecisaoAcertoDesistenciaContratual" df ON df.id=a."decisaoId" AND df.aprovada JOIN "PropostaAcertoDesistenciaContratual" pf ON pf.id=df."propostaId" WHERE pf."pedidoId"=pedido.id AND pf."estadoHash"=pedido."estadoHash") THEN RAISE EXCEPTION 'Intenção de desistência exige Q121 e Q165 aprovados para o mesmo envio'; END IF;
 END IF;
 RETURN NEW;
END $$;

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
 IF NEW.estado IN ('PREPARADO','ENVIANDO','ENVIO_INCERTO','ENVIADO') AND fonte_assinada_substituicao_218(NEW.id) THEN RAISE EXCEPTION 'Contrato anterior assinado exige conferência Q117'; END IF;
 RETURN NEW;
END $$;
COMMIT;





