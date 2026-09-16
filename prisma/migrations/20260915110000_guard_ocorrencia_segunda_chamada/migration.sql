-- Q148/Q152: reserva, ocorrência e realização formam um único fato terminal.
ALTER TABLE "ReservaSegundaChamada"
  ALTER COLUMN "reservadaEm" SET DEFAULT (clock_timestamp() AT TIME ZONE 'UTC');
ALTER TABLE "OcorrenciaSegundaChamada"
  ALTER COLUMN "criadaEm" SET DEFAULT (clock_timestamp() AT TIME ZONE 'UTC');

CREATE FUNCTION complementar_reserva_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE antecedencia INTEGER;
BEGIN
 IF NEW.status<>'RESERVADA' THEN RAISE EXCEPTION 'Reserva nova exige status RESERVADA'; END IF;
 PERFORM id FROM "Usuario" WHERE id=NEW."reservadaPorId" AND ativo
   AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reserva exige gestão ativa'; END IF;
 SELECT (conteudo#>>'{segundaChamada,antecedenciaCancelamentoMinutos}')::integer INTO antecedencia
   FROM "VersaoRegraAvaliacao" WHERE id=NEW."regraId" FOR SHARE;
 IF antecedencia IS NULL OR NEW."regraCancelamentoMinutos" IS DISTINCT FROM antecedencia THEN
  RAISE EXCEPTION 'Reserva exige antecedência de cancelamento da regra';
 END IF;
 NEW."reservadaEm":=clock_timestamp() AT TIME ZONE 'UTC';
 RETURN NEW;
END $$;

CREATE FUNCTION preservar_reserva_segunda_chamada_terminal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Reserva de segunda chamada não pode ser apagada'; END IF;
 IF (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') THEN
  RAISE EXCEPTION 'Somente o status da reserva de segunda chamada pode mudar';
 END IF;
 IF OLD.status<>'RESERVADA' OR NEW.status NOT IN (
   'LIBERADA_CANCELAMENTO_ESCOLA','LIBERADA_CANCELAMENTO_TEMPESTIVO',
   'CONSUMIDA_REALIZACAO','CONSUMIDA_FALTA','CONSUMIDA_CANCELAMENTO_TARDIO','PENDENCIA_ESCOLA'
 ) THEN RAISE EXCEPTION 'Transição terminal de reserva inválida'; END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION preservar_ocorrencia_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reserva "ReservaSegundaChamada"%ROWTYPE; inicio_agendado TIMESTAMP; agora TIMESTAMP;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Ocorrência de segunda chamada é imutável'; END IF;
 SELECT * INTO reserva FROM "ReservaSegundaChamada" WHERE id=NEW."reservaId" FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ocorrência exige reserva existente'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT e.inicio INTO inicio_agendado FROM "AgendaSegundaChamada" agenda
   JOIN "EncontroAgenda" e ON e.id=agenda."encontroId"
   WHERE agenda."reservaId"=reserva.id FOR SHARE OF agenda,e;
 PERFORM id FROM "Usuario" WHERE id=NEW."registradaPorId" AND ativo
   AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ocorrência exige gestão ativa'; END IF;
 agora:=clock_timestamp() AT TIME ZONE 'UTC';
 IF NEW.status NOT IN (
   'LIBERADA_CANCELAMENTO_ESCOLA','LIBERADA_CANCELAMENTO_TEMPESTIVO',
   'CONSUMIDA_FALTA','CONSUMIDA_CANCELAMENTO_TARDIO','PENDENCIA_ESCOLA'
 ) OR NEW.status IS DISTINCT FROM reserva.status THEN RAISE EXCEPTION 'Status da ocorrência incompatível com a reserva'; END IF;
 IF NEW."ocorridaEm" IS NULL OR NOT isfinite(NEW."ocorridaEm") OR NOT isfinite(reserva."reservadaEm")
   OR NEW."ocorridaEm">agora OR NEW."ocorridaEm"<reserva."reservadaEm" THEN RAISE EXCEPTION 'Data da ocorrência inválida'; END IF;
 IF length(btrim(NEW.motivo))<5 OR length(NEW.motivo)>2000
   OR length(btrim(NEW.evidencia))<5 OR length(NEW.evidencia)>4000 THEN RAISE EXCEPTION 'Conteúdo da ocorrência inválido'; END IF;
 IF NEW.status='CONSUMIDA_FALTA' AND (inicio_agendado IS NULL OR NEW."ocorridaEm"<inicio_agendado) THEN
  RAISE EXCEPTION 'Falta exige início agendado já alcançado';
 END IF;
 IF NEW.status='LIBERADA_CANCELAMENTO_TEMPESTIVO' AND (inicio_agendado IS NULL OR NEW."ocorridaEm">inicio_agendado-reserva."regraCancelamentoMinutos"*interval '1 minute') THEN
  RAISE EXCEPTION 'Cancelamento não respeita a antecedência contratada';
 END IF;
 IF NEW.status='CONSUMIDA_CANCELAMENTO_TARDIO' AND inicio_agendado IS NOT NULL
   AND NEW."ocorridaEm"<=inicio_agendado-reserva."regraCancelamentoMinutos"*interval '1 minute' THEN
  RAISE EXCEPTION 'Cancelamento deveria ser tempestivo pela regra contratada';
 END IF;
 IF EXISTS (SELECT 1 FROM "OcorrenciaSegundaChamada" WHERE "reservaId"=reserva.id FOR KEY SHARE)
   OR EXISTS (SELECT 1 FROM "RealizacaoSegundaChamada" WHERE "reservaId"=reserva.id FOR KEY SHARE) THEN
  RAISE EXCEPTION 'Reserva já possui fato terminal';
 END IF;
 NEW."criadaEm":=agora;
 RETURN NEW;
END $$;

CREATE FUNCTION preservar_realizacao_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Realização de segunda chamada é imutável'; END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION conferir_fato_terminal_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reserva_id TEXT; reserva_status "StatusReservaSegundaChamada"; ocorrencia_status "StatusReservaSegundaChamada"; ocorrencias INTEGER; realizacoes INTEGER;
BEGIN
 IF TG_TABLE_NAME='ReservaSegundaChamada' THEN reserva_id:=COALESCE(NEW.id,OLD.id);
 ELSIF TG_TABLE_NAME='OcorrenciaSegundaChamada' THEN reserva_id:=COALESCE(NEW."reservaId",OLD."reservaId");
 ELSE reserva_id:=COALESCE(NEW."reservaId",OLD."reservaId"); END IF;
 SELECT status INTO reserva_status FROM "ReservaSegundaChamada" WHERE id=reserva_id FOR KEY SHARE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT count(*) INTO ocorrencias FROM "OcorrenciaSegundaChamada" WHERE "reservaId"=reserva_id;
 SELECT count(*) INTO realizacoes FROM "RealizacaoSegundaChamada" WHERE "reservaId"=reserva_id;
 IF ocorrencias=1 THEN SELECT status INTO ocorrencia_status FROM "OcorrenciaSegundaChamada" WHERE "reservaId"=reserva_id; END IF;
 IF reserva_status='RESERVADA' AND (ocorrencias<>0 OR realizacoes<>0) THEN
  RAISE EXCEPTION 'Reserva ativa não pode possuir fato terminal';
 ELSIF reserva_status='CONSUMIDA_REALIZACAO' AND (realizacoes<>1 OR ocorrencias<>0) THEN
  RAISE EXCEPTION 'Reserva realizada exige uma realização exata';
ELSIF reserva_status IN ('LIBERADA_CANCELAMENTO_ESCOLA','LIBERADA_CANCELAMENTO_TEMPESTIVO','CONSUMIDA_FALTA','CONSUMIDA_CANCELAMENTO_TARDIO','PENDENCIA_ESCOLA')
   AND (ocorrencias<>1 OR realizacoes<>0 OR ocorrencia_status IS DISTINCT FROM reserva_status) THEN
  RAISE EXCEPTION 'Reserva terminal exige uma ocorrência exata';
 END IF;
 RETURN NULL;
END $$;

CREATE TRIGGER complementar_reserva_segunda_chamada
BEFORE INSERT ON "ReservaSegundaChamada"
FOR EACH ROW EXECUTE FUNCTION complementar_reserva_segunda_chamada();
CREATE TRIGGER preservar_reserva_segunda_chamada_terminal
BEFORE UPDATE OR DELETE ON "ReservaSegundaChamada"
FOR EACH ROW EXECUTE FUNCTION preservar_reserva_segunda_chamada_terminal();
CREATE TRIGGER preservar_ocorrencia_segunda_chamada
BEFORE INSERT OR UPDATE OR DELETE ON "OcorrenciaSegundaChamada"
FOR EACH ROW EXECUTE FUNCTION preservar_ocorrencia_segunda_chamada();
CREATE TRIGGER preservar_realizacao_segunda_chamada
BEFORE UPDATE OR DELETE ON "RealizacaoSegundaChamada"
FOR EACH ROW EXECUTE FUNCTION preservar_realizacao_segunda_chamada();

CREATE CONSTRAINT TRIGGER conferir_reserva_segunda_chamada_terminal
AFTER UPDATE ON "ReservaSegundaChamada" DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION conferir_fato_terminal_segunda_chamada();
CREATE CONSTRAINT TRIGGER conferir_ocorrencia_segunda_chamada_terminal
AFTER INSERT ON "OcorrenciaSegundaChamada" DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION conferir_fato_terminal_segunda_chamada();
CREATE CONSTRAINT TRIGGER conferir_realizacao_segunda_chamada_terminal
AFTER INSERT ON "RealizacaoSegundaChamada" DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION conferir_fato_terminal_segunda_chamada();
