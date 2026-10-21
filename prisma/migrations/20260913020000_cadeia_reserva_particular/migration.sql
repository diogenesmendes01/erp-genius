CREATE TABLE "RetomadaReservaParticular" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "anteriorId" TEXT NOT NULL UNIQUE REFERENCES "ReservaAgendaParticular"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  "novaId" TEXT NOT NULL UNIQUE REFERENCES "ReservaAgendaParticular"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  "autorId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  "motivo" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE FUNCTION preservar_retomada_reserva_particular() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Retomada de reserva deve permanecer preservada'; END IF;
  IF NEW."anteriorId" = NEW."novaId" OR NOT EXISTS (
    SELECT 1 FROM "ReservaAgendaParticular" a JOIN "ReservaAgendaParticular" n ON n."matriculaId"=a."matriculaId"
    WHERE a.id=NEW."anteriorId" AND n.id=NEW."novaId" AND a.status IN ('EXPIRADA','LIBERADA')
      AND n.status='ATIVA' AND n."criadaEm">=a."criadaEm"
  ) THEN RAISE EXCEPTION 'Retomada exige reserva anterior encerrada e nova reserva da mesma matrícula'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER retomada_particular_preservada BEFORE INSERT OR UPDATE OR DELETE ON "RetomadaReservaParticular" FOR EACH ROW EXECUTE FUNCTION preservar_retomada_reserva_particular();
