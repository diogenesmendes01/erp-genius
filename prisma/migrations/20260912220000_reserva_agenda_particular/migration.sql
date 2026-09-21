-- CreateTable
CREATE TABLE "ReservaAgendaParticular" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "status" "StatusReservaVaga" NOT NULL DEFAULT 'ATIVA',
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "ReservaAgendaParticular_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HorarioReservaParticular" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "fusoOrigem" TEXT NOT NULL,

    CONSTRAINT "HorarioReservaParticular_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReservaAgendaParticular_matriculaId_criadaEm_idx" ON "ReservaAgendaParticular"("matriculaId", "criadaEm");

-- CreateIndex
CREATE UNIQUE INDEX "ReservaAgendaParticular_preparadorId_chaveIdempotencia_key" ON "ReservaAgendaParticular"("preparadorId", "chaveIdempotencia");

-- CreateIndex
CREATE INDEX "HorarioReservaParticular_professorId_inicio_fim_idx" ON "HorarioReservaParticular"("professorId", "inicio", "fim");

-- CreateIndex
CREATE INDEX "HorarioReservaParticular_reservaId_idx" ON "HorarioReservaParticular"("reservaId");

-- AddForeignKey
ALTER TABLE "ReservaAgendaParticular" ADD CONSTRAINT "ReservaAgendaParticular_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ReservaAgendaParticular" ADD CONSTRAINT "ReservaAgendaParticular_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "HorarioReservaParticular" ADD CONSTRAINT "HorarioReservaParticular_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "ReservaAgendaParticular"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "HorarioReservaParticular" ADD CONSTRAINT "HorarioReservaParticular_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "ReservaAgendaParticular" ADD CONSTRAINT "reserva_particular_prazo" CHECK ("expiraEm" > "criadaEm");
ALTER TABLE "HorarioReservaParticular" ADD CONSTRAINT "horario_particular_intervalo" CHECK (fim > inicio);
CREATE UNIQUE INDEX "reserva_particular_ativa_matricula" ON "ReservaAgendaParticular" ("matriculaId") WHERE status IN ('ATIVA', 'MANTIDA_PENDENCIA');
CREATE UNIQUE INDEX "horario_particular_unico" ON "HorarioReservaParticular" ("reservaId", "professorId", inicio);

CREATE FUNCTION proteger_reserva_particular() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Histórico de reserva particular não pode ser apagado'; END IF;
  IF (to_jsonb(NEW) - 'status' - 'expiraEm') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'expiraEm') THEN
    RAISE EXCEPTION 'Base da reserva particular é imutável';
  END IF;
  IF OLD.status NOT IN ('ATIVA', 'MANTIDA_PENDENCIA') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Reserva particular encerrada não pode ser reativada';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER proteger_reserva_particular BEFORE UPDATE OR DELETE ON "ReservaAgendaParticular" FOR EACH ROW EXECUTE FUNCTION proteger_reserva_particular();

CREATE FUNCTION conferir_horario_reserva_particular() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Horários da reserva são imutáveis'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  IF NOT EXISTS (SELECT 1 FROM "ReservaAgendaParticular" r WHERE r.id = NEW."reservaId" AND r.status = 'ATIVA'
    AND r.snapshot->>'professorId' = NEW."professorId" AND r.snapshot->>'fusoOrigem' = NEW."fusoOrigem"
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(r.snapshot->'encontros') e WHERE (e->>'inicio')::timestamp = NEW.inicio AND (e->>'fim')::timestamp = NEW.fim)) THEN
    RAISE EXCEPTION 'Horário não corresponde à revisão da reserva';
  END IF;
  IF EXISTS (SELECT 1 FROM "EncontroAgenda" e WHERE e."professorId" = NEW."professorId" AND e.status IN ('PREVISTO', 'MINISTRADO') AND e.inicio < NEW.fim AND e.fim > NEW.inicio) THEN
    RAISE EXCEPTION 'Horário particular conflita com agenda publicada';
  END IF;
  IF EXISTS (SELECT 1 FROM "HorarioReservaParticular" h JOIN "ReservaAgendaParticular" r ON r.id = h."reservaId"
    WHERE r.status IN ('ATIVA', 'MANTIDA_PENDENCIA') AND h."professorId" = NEW."professorId" AND h.inicio < NEW.fim AND h.fim > NEW.inicio) THEN
    RAISE EXCEPTION 'Horário particular já reservado';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER conferir_horario_reserva_particular BEFORE INSERT OR UPDATE OR DELETE ON "HorarioReservaParticular" FOR EACH ROW EXECUTE FUNCTION conferir_horario_reserva_particular();

CREATE FUNCTION impedir_encontro_sobre_reserva_particular() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status NOT IN ('PREVISTO', 'MINISTRADO') OR NEW."professorId" IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  IF EXISTS (SELECT 1 FROM "HorarioReservaParticular" h JOIN "ReservaAgendaParticular" r ON r.id = h."reservaId"
    WHERE r.status IN ('ATIVA', 'MANTIDA_PENDENCIA') AND h."professorId" = NEW."professorId" AND h.inicio < NEW.fim AND h.fim > NEW.inicio) THEN
    RAISE EXCEPTION 'Agenda conflita com horário particular reservado';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER impedir_encontro_sobre_reserva_particular BEFORE INSERT OR UPDATE OF inicio, fim, "professorId", status ON "EncontroAgenda" FOR EACH ROW EXECUTE FUNCTION impedir_encontro_sobre_reserva_particular();

CREATE FUNCTION impedir_reservas_mistas() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status NOT IN ('ATIVA', 'MANTIDA_PENDENCIA') THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  IF TG_TABLE_NAME = 'ReservaAgendaParticular' THEN
    IF EXISTS (SELECT 1 FROM "ReservaVagaMatricula" WHERE "matriculaId" = NEW."matriculaId" AND status IN ('ATIVA', 'MANTIDA_PENDENCIA')) THEN RAISE EXCEPTION 'Matrícula já possui reserva de turma'; END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM "ReservaAgendaParticular" WHERE "matriculaId" = NEW."matriculaId" AND status IN ('ATIVA', 'MANTIDA_PENDENCIA')) THEN RAISE EXCEPTION 'Matrícula já possui reserva particular'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER impedir_reservas_mistas BEFORE INSERT OR UPDATE OF status ON "ReservaAgendaParticular" FOR EACH ROW EXECUTE FUNCTION impedir_reservas_mistas();
CREATE TRIGGER impedir_reservas_mistas BEFORE INSERT OR UPDATE OF status ON "ReservaVagaMatricula" FOR EACH ROW EXECUTE FUNCTION impedir_reservas_mistas();
