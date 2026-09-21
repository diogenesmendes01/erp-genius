-- Q121: única efetivação permitida para uma preparação sem avanço formal.
CREATE TABLE "EfetivacaoPedidoDesistenciaPreparacao" (
  "id" TEXT NOT NULL,
  "pedidoId" TEXT NOT NULL,
  "matriculaId" TEXT NOT NULL,
  "executorId" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "entradaHash" TEXT NOT NULL,
  "estadoHash" TEXT NOT NULL,
  "aplicadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),
  CONSTRAINT "EfetivacaoPedidoDesistenciaPreparacao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EfetivacaoPedidoDesistenciaPreparacao_motivo_tamanho" CHECK (length(btrim("motivo")) BETWEEN 10 AND 3000),
  CONSTRAINT "EfetivacaoPedidoDesistenciaPreparacao_hashes_formato" CHECK ("entradaHash" ~ '^[a-f0-9]{64}$' AND "estadoHash" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "EfetivacaoPedidoDesistenciaPreparacao_pedidoId_key" ON "EfetivacaoPedidoDesistenciaPreparacao"("pedidoId");
CREATE UNIQUE INDEX "EfetivacaoPedidoDesistenciaPreparacao_matriculaId_key" ON "EfetivacaoPedidoDesistenciaPreparacao"("matriculaId");
ALTER TABLE "EfetivacaoPedidoDesistenciaPreparacao"
  ADD CONSTRAINT "EfetivacaoPedidoDesistenciaPreparacao_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoDesistenciaPreparacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "EfetivacaoPedidoDesistenciaPreparacao_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "EfetivacaoPedidoDesistenciaPreparacao_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE OR REPLACE FUNCTION conferir_efetivacao_pedido_desistencia_preparacao()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  pedido RECORD;
  matricula_atual RECORD;
  usuario_atual RECORD;
  lead_atual TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Efetivação de desistência deve permanecer preservada';
  END IF;
  SELECT p.* INTO pedido FROM "PedidoDesistenciaPreparacao" p WHERE p.id = NEW."pedidoId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de desistência não encontrado'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT "leadId" INTO lead_atual FROM "Matricula" WHERE id = pedido."matriculaId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Matrícula do pedido não encontrada'; END IF;
  IF lead_atual IS NOT NULL THEN PERFORM id FROM "Lead" WHERE id = lead_atual FOR UPDATE; END IF;
  SELECT * INTO matricula_atual FROM "Matricula" WHERE id = pedido."matriculaId" FOR UPDATE;
  PERFORM id FROM "PedidoDesistenciaPreparacao" WHERE id = pedido.id FOR UPDATE;
  PERFORM id FROM "ReservaVagaMatricula" WHERE "matriculaId" = pedido."matriculaId" ORDER BY id FOR UPDATE;
  PERFORM id FROM "ReservaAgendaParticular" WHERE "matriculaId" = pedido."matriculaId" ORDER BY id FOR UPDATE;
  PERFORM id FROM "Usuario" WHERE id = NEW."executorId" FOR SHARE;
  SELECT ativo, papeis INTO usuario_atual FROM "Usuario" WHERE id = NEW."executorId";
  IF NOT FOUND OR NOT usuario_atual.ativo OR NOT ('SECRETARIA_ACADEMICA'::"Papel" = ANY(usuario_atual.papeis) OR 'ADMINISTRADOR'::"Papel" = ANY(usuario_atual.papeis)) THEN
    RAISE EXCEPTION 'Efetivação exige Secretaria ou Administração ativa';
  END IF;
  IF NEW."matriculaId" IS DISTINCT FROM pedido."matriculaId" OR NEW."estadoHash" IS DISTINCT FROM pedido."estadoHash" THEN
    RAISE EXCEPTION 'Efetivação não corresponde ao pedido conferido';
  END IF;
  IF matricula_atual.status NOT IN ('RASCUNHO', 'AGUARDANDO') OR matricula_atual."ativadaEm" IS NOT NULL
    OR matricula_atual."contratoOk" OR matricula_atual."confirmacaoContratoEm" IS NOT NULL OR matricula_atual."contratoDocumentoId" IS NOT NULL THEN
    RAISE EXCEPTION 'Efetivação exige matrícula ainda em preparação';
  END IF;
  IF EXISTS (SELECT 1 FROM "PedidoDesistenciaPreparacao" p WHERE p."matriculaId" = pedido."matriculaId" AND p.versao > pedido.versao) THEN
    RAISE EXCEPTION 'Há pedido de desistência mais recente';
  END IF;
  IF pedido."snapshotJson"->'matricula'->>'status' IS DISTINCT FROM matricula_atual.status::text
    OR pedido."snapshotJson"->'matricula'->>'leadId' IS DISTINCT FROM lead_atual
    OR (pedido."snapshotJson"->'matricula'->>'ativadaEm') IS DISTINCT FROM (CASE WHEN matricula_atual."ativadaEm" IS NULL THEN NULL ELSE to_char(matricula_atual."ativadaEm" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END)
    OR (pedido."snapshotJson"->'matricula'->>'contratoOk') IS DISTINCT FROM (CASE WHEN matricula_atual."contratoOk" THEN 'true' ELSE 'false' END)
    OR (pedido."snapshotJson"->'matricula'->>'confirmacaoContratoEm') IS DISTINCT FROM (CASE WHEN matricula_atual."confirmacaoContratoEm" IS NULL THEN NULL ELSE to_char(matricula_atual."confirmacaoContratoEm" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END)
    OR pedido."snapshotJson"->'matricula'->>'contratoDocumentoId' IS DISTINCT FROM matricula_atual."contratoDocumentoId" THEN
    RAISE EXCEPTION 'A fonte da matrícula mudou desde a conferência';
  END IF;
  IF (pedido."snapshotJson"->'preparacao' = 'null'::jsonb) IS DISTINCT FROM (NOT EXISTS (SELECT 1 FROM "PreparacaoComercialMatricula" WHERE "matriculaId" = pedido."matriculaId"))
    OR EXISTS (SELECT 1 FROM "PreparacaoComercialMatricula" pc WHERE pc."matriculaId" = pedido."matriculaId" AND (
      pedido."snapshotJson"->'preparacao'->>'id' IS DISTINCT FROM pc.id OR pedido."snapshotJson"->'preparacao'->>'reservaId' IS DISTINCT FROM pc."reservaId"
      OR pedido."snapshotJson"->'preparacao'->>'reservaParticularId' IS DISTINCT FROM pc."reservaParticularId" OR pedido."snapshotJson"->'preparacao'->>'regime' IS DISTINCT FROM pc.regime::text
      OR pedido."snapshotJson"->'preparacao'->>'entradaHash' IS DISTINCT FROM pc."entradaHash")) THEN
    RAISE EXCEPTION 'A preparação comercial mudou desde a conferência';
  END IF;
  IF jsonb_array_length(COALESCE(pedido."snapshotJson"->'condicoes', '[]'::jsonb)) <> (SELECT count(*) FROM "CondicoesEntradaPreparacao" WHERE "matriculaId" = pedido."matriculaId")
    OR EXISTS (SELECT 1 FROM "CondicoesEntradaPreparacao" c WHERE c."matriculaId" = pedido."matriculaId" AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'condicoes') s
      WHERE s->>'id' = c.id AND (s->>'versao')::integer = c.versao AND s->>'entradaHash' = c."entradaHash")) THEN
    RAISE EXCEPTION 'As condições de preparação mudaram desde a conferência';
  END IF;
  IF jsonb_array_length(COALESCE(pedido."snapshotJson"->'reservasColetivas', '[]'::jsonb)) <> (SELECT count(*) FROM "ReservaVagaMatricula" WHERE "matriculaId" = pedido."matriculaId")
    OR EXISTS (SELECT 1 FROM "ReservaVagaMatricula" r WHERE r."matriculaId" = pedido."matriculaId" AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'reservasColetivas') s
      WHERE s->>'id' = r.id AND s->>'turmaId' = r."turmaId" AND s->>'janelaId' = r."janelaId" AND s->>'status' = r.status::text
        AND (s->>'expiraEm')::timestamptz AT TIME ZONE 'UTC' = r."expiraEm" AND s->>'entradaHash' = r."entradaHash")) THEN
    RAISE EXCEPTION 'A reserva coletiva mudou desde a conferência';
  END IF;
  IF jsonb_array_length(COALESCE(pedido."snapshotJson"->'reservasParticulares', '[]'::jsonb)) <> (SELECT count(*) FROM "ReservaAgendaParticular" WHERE "matriculaId" = pedido."matriculaId")
    OR EXISTS (SELECT 1 FROM "ReservaAgendaParticular" r WHERE r."matriculaId" = pedido."matriculaId" AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'reservasParticulares') s
      WHERE s->>'id' = r.id AND s->>'status' = r.status::text
        AND (s->>'expiraEm')::timestamptz AT TIME ZONE 'UTC' = r."expiraEm" AND s->>'entradaHash' = r."entradaHash"))
    OR EXISTS (SELECT 1 FROM "HorarioReservaParticular" h JOIN "ReservaAgendaParticular" r ON r.id = h."reservaId"
      WHERE r."matriculaId" = pedido."matriculaId" AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'reservasParticulares') s, jsonb_array_elements(s->'horarios') hjson
        WHERE s->>'id' = r.id AND hjson->>'id' = h.id AND hjson->>'professorId' = h."professorId" AND hjson->>'fusoOrigem' = h."fusoOrigem"
          AND (hjson->>'inicio')::timestamptz AT TIME ZONE 'UTC' = h.inicio AND (hjson->>'fim')::timestamptz AT TIME ZONE 'UTC' = h.fim)) THEN
    RAISE EXCEPTION 'A reserva particular mudou desde a conferência';
  END IF;
  IF EXISTS (SELECT 1 FROM "Cobranca" WHERE "matriculaId" = pedido."matriculaId")
    OR EXISTS (SELECT 1 FROM "CreditoMatricula" WHERE "matriculaId" = pedido."matriculaId")
    OR EXISTS (SELECT 1 FROM "ProcessoAssinaturaContratual" WHERE "matriculaId" = pedido."matriculaId")
    OR EXISTS (SELECT 1 FROM "Documento" WHERE "matriculaId" = pedido."matriculaId")
    OR EXISTS (SELECT 1 FROM "AlocacaoTurma" WHERE "matriculaId" = pedido."matriculaId") THEN
    RAISE EXCEPTION 'Efetivação simples exige ausência de avanço financeiro, documental, assinatura e alocação';
  END IF;
  IF EXISTS (SELECT 1 FROM "ReservaVagaMatricula" WHERE "matriculaId" = pedido."matriculaId" AND status = 'UTILIZADA')
    OR EXISTS (SELECT 1 FROM "ReservaAgendaParticular" WHERE "matriculaId" = pedido."matriculaId" AND status = 'UTILIZADA') THEN
    RAISE EXCEPTION 'Reserva utilizada exige fluxo de acerto';
  END IF;
  IF EXISTS (SELECT 1 FROM "ReservaVagaMatricula" WHERE "matriculaId" = pedido."matriculaId" AND status NOT IN ('ATIVA', 'MANTIDA_PENDENCIA', 'EXPIRADA', 'LIBERADA'))
    OR EXISTS (SELECT 1 FROM "ReservaAgendaParticular" WHERE "matriculaId" = pedido."matriculaId" AND status NOT IN ('ATIVA', 'MANTIDA_PENDENCIA', 'EXPIRADA', 'LIBERADA')) THEN
    RAISE EXCEPTION 'Estado de reserva incompatível com a efetivação';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "EfetivacaoPedidoDesistenciaPreparacao_conferir"
  BEFORE INSERT OR UPDATE OR DELETE ON "EfetivacaoPedidoDesistenciaPreparacao"
  FOR EACH ROW EXECUTE FUNCTION conferir_efetivacao_pedido_desistencia_preparacao();

CREATE OR REPLACE FUNCTION aplicar_efetivacao_pedido_desistencia_preparacao()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "ReservaVagaMatricula" SET status = 'LIBERADA'
    WHERE "matriculaId" = NEW."matriculaId" AND status IN ('ATIVA', 'MANTIDA_PENDENCIA');
  UPDATE "ReservaAgendaParticular" SET status = 'LIBERADA'
    WHERE "matriculaId" = NEW."matriculaId" AND status IN ('ATIVA', 'MANTIDA_PENDENCIA');
  UPDATE "Matricula" SET status = 'CANCELADA' WHERE id = NEW."matriculaId";
  RETURN NEW;
END $$;
CREATE TRIGGER "EfetivacaoPedidoDesistenciaPreparacao_aplicar"
  AFTER INSERT ON "EfetivacaoPedidoDesistenciaPreparacao"
  FOR EACH ROW EXECUTE FUNCTION aplicar_efetivacao_pedido_desistencia_preparacao();

CREATE OR REPLACE FUNCTION validar_efetivacao_pedido_desistencia_preparacao()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Matricula" WHERE id = NEW."matriculaId" AND status = 'CANCELADA')
    OR EXISTS (SELECT 1 FROM "ReservaVagaMatricula" WHERE "matriculaId" = NEW."matriculaId" AND status IN ('ATIVA', 'MANTIDA_PENDENCIA'))
    OR EXISTS (SELECT 1 FROM "ReservaAgendaParticular" WHERE "matriculaId" = NEW."matriculaId" AND status IN ('ATIVA', 'MANTIDA_PENDENCIA')) THEN
    RAISE EXCEPTION 'Efetivação deve cancelar matrícula e liberar todas as reservas vigentes';
  END IF;
  IF EXISTS (SELECT 1 FROM "Matricula" m WHERE m.id = NEW."matriculaId" AND
      (m."ativadaEm" IS NOT NULL OR m."contratoOk" OR m."confirmacaoContratoEm" IS NOT NULL OR m."contratoDocumentoId" IS NOT NULL))
    OR EXISTS (SELECT 1 FROM "Cobranca" WHERE "matriculaId" = NEW."matriculaId")
    OR EXISTS (SELECT 1 FROM "CreditoMatricula" WHERE "matriculaId" = NEW."matriculaId")
    OR EXISTS (SELECT 1 FROM "ProcessoAssinaturaContratual" WHERE "matriculaId" = NEW."matriculaId")
    OR EXISTS (SELECT 1 FROM "Documento" WHERE "matriculaId" = NEW."matriculaId")
    OR EXISTS (SELECT 1 FROM "AlocacaoTurma" WHERE "matriculaId" = NEW."matriculaId") THEN
    RAISE EXCEPTION 'Efetivação simples não permite fonte concorrente no commit';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "EfetivacaoPedidoDesistenciaPreparacao_validar"
  AFTER INSERT ON "EfetivacaoPedidoDesistenciaPreparacao"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validar_efetivacao_pedido_desistencia_preparacao();

CREATE OR REPLACE FUNCTION proteger_matricula_efetivada_desistencia()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "EfetivacaoPedidoDesistenciaPreparacao" WHERE "matriculaId" = NEW.id)
    AND (NEW.status IS DISTINCT FROM 'CANCELADA' OR NEW."ativadaEm" IS NOT NULL OR NEW."contratoOk"
      OR NEW."confirmacaoContratoEm" IS NOT NULL OR NEW."contratoDocumentoId" IS NOT NULL) THEN
    RAISE EXCEPTION 'Matrícula cancelada por desistência simples não pode ser reativada ou receber avanço contratual';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Matricula_proteger_efetivada_desistencia"
  BEFORE UPDATE ON "Matricula" FOR EACH ROW EXECUTE FUNCTION proteger_matricula_efetivada_desistencia();

CREATE OR REPLACE FUNCTION proteger_reserva_efetivada_desistencia()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('ATIVA', 'MANTIDA_PENDENCIA', 'UTILIZADA')
    AND EXISTS (SELECT 1 FROM "EfetivacaoPedidoDesistenciaPreparacao" WHERE "matriculaId" = NEW."matriculaId") THEN
    RAISE EXCEPTION 'Reserva de matrícula cancelada por desistência simples não pode voltar a vigorar ou ser utilizada';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ReservaVaga_proteger_efetivada_desistencia"
  BEFORE INSERT OR UPDATE OF status ON "ReservaVagaMatricula" FOR EACH ROW EXECUTE FUNCTION proteger_reserva_efetivada_desistencia();
CREATE TRIGGER "ReservaParticular_proteger_efetivada_desistencia"
  BEFORE INSERT OR UPDATE OF status ON "ReservaAgendaParticular" FOR EACH ROW EXECUTE FUNCTION proteger_reserva_efetivada_desistencia();

CREATE OR REPLACE FUNCTION impedir_avanco_apos_desistencia_simples()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  matricula_origem TEXT;
BEGIN
  matricula_origem := NEW."matriculaId";
  IF matricula_origem IS NOT NULL THEN
    PERFORM id FROM "Matricula" WHERE id = matricula_origem FOR UPDATE;
    IF EXISTS (SELECT 1 FROM "EfetivacaoPedidoDesistenciaPreparacao" WHERE "matriculaId" = matricula_origem) THEN
      RAISE EXCEPTION 'Matrícula cancelada por desistência simples não aceita novo avanço formal';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Cobranca_impedir_avanco_desistencia_simples"
  BEFORE INSERT OR UPDATE OF "matriculaId" ON "Cobranca" FOR EACH ROW EXECUTE FUNCTION impedir_avanco_apos_desistencia_simples();
CREATE TRIGGER "CreditoMatricula_impedir_avanco_desistencia_simples"
  BEFORE INSERT OR UPDATE OF "matriculaId" ON "CreditoMatricula" FOR EACH ROW EXECUTE FUNCTION impedir_avanco_apos_desistencia_simples();
CREATE TRIGGER "ProcessoAssinatura_impedir_avanco_desistencia_simples"
  BEFORE INSERT OR UPDATE OF "matriculaId" ON "ProcessoAssinaturaContratual" FOR EACH ROW EXECUTE FUNCTION impedir_avanco_apos_desistencia_simples();
CREATE TRIGGER "AlocacaoTurma_impedir_avanco_desistencia_simples"
  BEFORE INSERT OR UPDATE OF "matriculaId" ON "AlocacaoTurma" FOR EACH ROW EXECUTE FUNCTION impedir_avanco_apos_desistencia_simples();
