-- PENDENCIA_ESCOLA preserva o impedimento da oferta sem consumir a
-- oportunidade. O encontro correspondente deixa de parecer previsto, mas
-- não é um cancelamento nem uma realização.
CREATE FUNCTION impedimento_escola_agenda_segunda_chamada_valido(p_reserva_id TEXT, p_encontro_id TEXT)
RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT COALESCE(EXISTS (
  SELECT 1
  FROM "AgendaSegundaChamada" agenda
  JOIN "ReservaSegundaChamada" reserva ON reserva.id=agenda."reservaId"
  JOIN "OcorrenciaSegundaChamada" ocorrencia ON ocorrencia."reservaId"=reserva.id
  WHERE reserva.id=p_reserva_id
    AND agenda."encontroId"=p_encontro_id
    AND reserva.status='PENDENCIA_ESCOLA'
    AND ocorrencia.status='PENDENCIA_ESCOLA'
 ),false);
$$;

CREATE FUNCTION preservar_impedimento_escola_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.status='IMPEDIDO_ESCOLA'::"StatusEncontroAgenda" THEN
   RAISE EXCEPTION 'Encontro de segunda chamada impedido pela escola não pode ser apagado';
  END IF;
  RETURN OLD;
 END IF;

 IF NEW.status='IMPEDIDO_ESCOLA'::"StatusEncontroAgenda" THEN
  IF NEW.finalidade<>'SEGUNDA_CHAMADA' THEN
   RAISE EXCEPTION 'Status impedido pela escola é exclusivo de segunda chamada';
  END IF;
  IF TG_OP='INSERT' THEN
   RAISE EXCEPTION 'Encontro impedido pela escola exige pendência terminal vinculada';
  END IF;
  IF OLD.status<>'PREVISTO'::"StatusEncontroAgenda"
     OR (to_jsonb(OLD)-'status') IS DISTINCT FROM (to_jsonb(NEW)-'status')
     OR NOT EXISTS (
       SELECT 1 FROM "AgendaSegundaChamada" agenda
       WHERE agenda."encontroId"=OLD.id
         AND impedimento_escola_agenda_segunda_chamada_valido(agenda."reservaId",OLD.id)
     ) THEN
   RAISE EXCEPTION 'Encontro impedido pela escola exige pendência terminal exata';
  END IF;
 ELSIF TG_OP='UPDATE' AND OLD.status='IMPEDIDO_ESCOLA'::"StatusEncontroAgenda" THEN
  RAISE EXCEPTION 'Encontro de segunda chamada impedido pela escola é imutável';
 END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER preservar_impedimento_escola_segunda_chamada
BEFORE INSERT OR UPDATE OR DELETE ON "EncontroAgenda"
FOR EACH ROW EXECUTE FUNCTION preservar_impedimento_escola_segunda_chamada();

CREATE FUNCTION preservar_agenda_segunda_chamada_impedida() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF impedimento_escola_agenda_segunda_chamada_valido(OLD."reservaId",OLD."encontroId") THEN
  RAISE EXCEPTION 'Agenda de segunda chamada impedida pela escola é imutável';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER preservar_agenda_segunda_chamada_impedida
BEFORE UPDATE OR DELETE ON "AgendaSegundaChamada"
FOR EACH ROW EXECUTE FUNCTION preservar_agenda_segunda_chamada_impedida();

CREATE FUNCTION conferir_reserva_aberta_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM "ReservaSegundaChamada" reserva
  WHERE reserva.id=NEW."reservaId" AND reserva.status='RESERVADA'
 ) THEN
  RAISE EXCEPTION 'Agenda de segunda chamada exige reserva aberta';
 END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER conferir_reserva_aberta_agenda_segunda_chamada
BEFORE INSERT OR UPDATE OF "reservaId","encontroId" ON "AgendaSegundaChamada"
FOR EACH ROW EXECUTE FUNCTION conferir_reserva_aberta_agenda_segunda_chamada();

CREATE FUNCTION concluir_impedimento_escola_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status<>'PENDENCIA_ESCOLA'::"StatusReservaSegundaChamada" THEN RETURN NEW; END IF;
 UPDATE "EncontroAgenda" encontro
 SET status='IMPEDIDO_ESCOLA'::"StatusEncontroAgenda"
 FROM "AgendaSegundaChamada" agenda
 JOIN "ReservaSegundaChamada" reserva ON reserva.id=agenda."reservaId"
 WHERE agenda."encontroId"=encontro.id
   AND agenda."reservaId"=NEW."reservaId"
   AND reserva.status='PENDENCIA_ESCOLA'
   AND encontro.status='PREVISTO'::"StatusEncontroAgenda";
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Impedimento da escola exige encontro previsto vinculado à reserva';
 END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER concluir_impedimento_escola_agenda_segunda_chamada
AFTER INSERT ON "OcorrenciaSegundaChamada"
FOR EACH ROW EXECUTE FUNCTION concluir_impedimento_escola_agenda_segunda_chamada();
