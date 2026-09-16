-- Q121/594: a trava de calendário precisa ser obtida antes das triggers de linha
-- que consultam a efetivação. Sem ela, uma reserva poderia observar ausência da
-- efetivação, aguardar outra trigger e só então ser inserida após o cancelamento.
CREATE OR REPLACE FUNCTION bloquear_calendario_reserva_desistencia_statement()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  RETURN NULL;
END $$;

CREATE TRIGGER "00_ReservaVaga_bloquear_calendario_desistencia"
  BEFORE INSERT OR UPDATE ON "ReservaVagaMatricula"
  FOR EACH STATEMENT EXECUTE FUNCTION bloquear_calendario_reserva_desistencia_statement();

CREATE TRIGGER "00_ReservaParticular_bloquear_calendario_desistencia"
  BEFORE INSERT OR UPDATE ON "ReservaAgendaParticular"
  FOR EACH STATEMENT EXECUTE FUNCTION bloquear_calendario_reserva_desistencia_statement();

-- A trava de matrícula vem depois da trava global e antes de consultar a
-- efetivação. Assim a inserção/reativação e a efetivação usam a mesma ordem.
CREATE OR REPLACE FUNCTION proteger_reserva_efetivada_desistencia()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('ATIVA', 'MANTIDA_PENDENCIA', 'UTILIZADA') THEN
    PERFORM id FROM "Matricula" WHERE id = NEW."matriculaId" FOR UPDATE;
    IF EXISTS (
      SELECT 1 FROM "EfetivacaoPedidoDesistenciaPreparacao"
      WHERE "matriculaId" = NEW."matriculaId"
    ) THEN
      RAISE EXCEPTION 'Reserva de matrícula cancelada por desistência simples não pode voltar a vigorar ou ser utilizada';
    END IF;
  END IF;
  RETURN NEW;
END $$;