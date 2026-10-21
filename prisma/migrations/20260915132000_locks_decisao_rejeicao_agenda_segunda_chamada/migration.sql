-- Rejeições mantêm os locks de reserva/calendário/proposta/agenda, mas não
-- exigem o contexto contratual atual que só é necessário para aplicar aprovação.

CREATE OR REPLACE FUNCTION bloquear_decisao_agenda_inicial_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE fonte_id TEXT;
BEGIN
  IF TG_OP<>'INSERT' THEN IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END IF;
  SELECT "propostaSegundaChamadaId" INTO fonte_id FROM "PropostaAgendaSegundaChamada" WHERE id=NEW."propostaId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de agenda não encontrada'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
  IF NEW.aprovada THEN
    PERFORM bloquear_contexto_fonte_segunda_chamada(fonte_id);
  END IF;
  PERFORM id FROM "PropostaAgendaSegundaChamada" WHERE id=NEW."propostaId" AND "propostaSegundaChamadaId"=fonte_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de agenda mudou durante a decisão'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION bloquear_decisao_remarcacao_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reserva_id TEXT; fonte_id TEXT;
BEGIN
  IF TG_OP<>'INSERT' THEN IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END IF;
  SELECT "reservaId" INTO reserva_id FROM "PropostaRemarcacaoAgendaSegundaChamada" WHERE id=NEW."propostaId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Decisão exige proposta de remarcação existente'; END IF;
  SELECT "propostaId" INTO fonte_id FROM "ReservaSegundaChamada" WHERE id=reserva_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Decisão exige reserva de remarcação existente'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
  IF NEW.aprovada THEN
    PERFORM bloquear_contexto_fonte_segunda_chamada(fonte_id);
  END IF;
  PERFORM id FROM "PropostaRemarcacaoAgendaSegundaChamada" WHERE id=NEW."propostaId" AND "reservaId"=reserva_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de remarcação mudou durante a decisão'; END IF;
  PERFORM a.id FROM "AgendaSegundaChamada" a JOIN "EncontroAgenda" e ON e.id=a."encontroId" WHERE a."reservaId"=reserva_id FOR SHARE OF a,e;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agenda da remarcação não encontrada'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION bloquear_decisao_substituicao_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reserva_id TEXT; fonte_id TEXT; encontro_id TEXT;
BEGIN
  IF TG_OP<>'INSERT' THEN IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END IF;
  SELECT "reservaId", "encontroId" INTO reserva_id,encontro_id FROM "PropostaSubstituicaoAgendaSegundaChamada" WHERE id=NEW."propostaId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Decisão exige proposta existente'; END IF;
  SELECT "propostaId" INTO fonte_id FROM "ReservaSegundaChamada" WHERE id=reserva_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Decisão exige reserva existente'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
  IF NEW.aprovada THEN
    PERFORM bloquear_contexto_fonte_segunda_chamada(fonte_id);
  END IF;
  PERFORM id FROM "PropostaSubstituicaoAgendaSegundaChamada" WHERE id=NEW."propostaId" AND "reservaId"=reserva_id AND "encontroId"=encontro_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de substituição mudou durante a decisão'; END IF;
  PERFORM id FROM "EncontroAgenda" WHERE id=encontro_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Encontro da substituição não encontrado'; END IF;
  RETURN NEW;
END $$;
