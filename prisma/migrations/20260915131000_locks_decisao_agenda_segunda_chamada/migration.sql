-- Q151 / incremento 590: toda decisão direta toma a mesma cadeia que bloquearLancamento.
-- Leituras iniciais só descobrem IDs; a fonte é relida após os locks.
CREATE FUNCTION bloquear_contexto_fonte_segunda_chamada(fonte_id TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  matricula_id TEXT;
  turma_id TEXT;
  alocacao_id TEXT;
  lead_id TEXT;
BEGIN
  IF fonte_id IS NULL THEN RAISE EXCEPTION 'Fonte da segunda chamada não encontrada'; END IF;

  SELECT f."matriculaId", f."turmaId", f."alocacaoId", m."leadId"
    INTO matricula_id, turma_id, alocacao_id, lead_id
    FROM "PropostaSegundaChamada" f
    JOIN "Matricula" m ON m.id=f."matriculaId"
    JOIN "AlocacaoTurma" a ON a.id=f."alocacaoId"
    JOIN "Turma" t ON t.id=f."turmaId"
    WHERE f.id=fonte_id;
  IF NOT FOUND OR matricula_id IS NULL OR turma_id IS NULL OR alocacao_id IS NULL THEN
    RAISE EXCEPTION 'Fonte da segunda chamada não possui contexto contratual íntegro';
  END IF;

  IF lead_id IS NOT NULL THEN
    PERFORM id FROM "Lead" WHERE id=lead_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Lead da matrícula não encontrado'; END IF;
  END IF;
  PERFORM id FROM "Matricula" WHERE id=matricula_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Matrícula da segunda chamada não encontrada'; END IF;
  PERFORM id FROM "Turma" WHERE id=turma_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Turma da segunda chamada não encontrada'; END IF;
  PERFORM id FROM "AlocacaoTurma" WHERE id=alocacao_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Alocação da segunda chamada não encontrada'; END IF;

  PERFORM f.id
    FROM "PropostaSegundaChamada" f
    JOIN "Matricula" m ON m.id=f."matriculaId"
    JOIN "Turma" t ON t.id=f."turmaId"
    JOIN "AlocacaoTurma" a ON a.id=f."alocacaoId"
    WHERE f.id=fonte_id
      AND f."matriculaId"=matricula_id AND f."turmaId"=turma_id AND f."alocacaoId"=alocacao_id
      AND m."leadId" IS NOT DISTINCT FROM lead_id
      AND a."matriculaId"=matricula_id AND a."turmaId"=turma_id
    FOR UPDATE OF f;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contexto da segunda chamada mudou durante a decisão'; END IF;
END $$;

CREATE FUNCTION bloquear_decisao_agenda_inicial_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE fonte_id TEXT;
BEGIN
  IF TG_OP<>'INSERT' THEN IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END IF;
  SELECT "propostaSegundaChamadaId" INTO fonte_id FROM "PropostaAgendaSegundaChamada" WHERE id=NEW."propostaId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de agenda não encontrada'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
  PERFORM bloquear_contexto_fonte_segunda_chamada(fonte_id);
  PERFORM id FROM "PropostaAgendaSegundaChamada" WHERE id=NEW."propostaId" AND "propostaSegundaChamadaId"=fonte_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de agenda mudou durante a decisão'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "00_bloquear_decisao_agenda_inicial_segunda_chamada"
BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoAgendaSegundaChamada"
FOR EACH ROW EXECUTE FUNCTION bloquear_decisao_agenda_inicial_segunda_chamada();

CREATE FUNCTION bloquear_decisao_remarcacao_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reserva_id TEXT; fonte_id TEXT;
BEGIN
  IF TG_OP<>'INSERT' THEN IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END IF;
  SELECT "reservaId" INTO reserva_id FROM "PropostaRemarcacaoAgendaSegundaChamada" WHERE id=NEW."propostaId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Decisão exige proposta de remarcação existente'; END IF;
  SELECT "propostaId" INTO fonte_id FROM "ReservaSegundaChamada" WHERE id=reserva_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Decisão exige reserva de remarcação existente'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
  PERFORM bloquear_contexto_fonte_segunda_chamada(fonte_id);
  PERFORM id FROM "PropostaRemarcacaoAgendaSegundaChamada" WHERE id=NEW."propostaId" AND "reservaId"=reserva_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de remarcação mudou durante a decisão'; END IF;
  PERFORM a.id FROM "AgendaSegundaChamada" a JOIN "EncontroAgenda" e ON e.id=a."encontroId" WHERE a."reservaId"=reserva_id FOR SHARE OF a,e;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agenda da remarcação não encontrada'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "00_bloquear_decisao_remarcacao_agenda_segunda_chamada"
BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoRemarcacaoAgendaSegundaChamada"
FOR EACH ROW EXECUTE FUNCTION bloquear_decisao_remarcacao_agenda_segunda_chamada();

CREATE FUNCTION bloquear_decisao_substituicao_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reserva_id TEXT; fonte_id TEXT; encontro_id TEXT;
BEGIN
  IF TG_OP<>'INSERT' THEN IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END IF;
  SELECT "reservaId", "encontroId" INTO reserva_id,encontro_id FROM "PropostaSubstituicaoAgendaSegundaChamada" WHERE id=NEW."propostaId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Decisão exige proposta existente'; END IF;
  SELECT "propostaId" INTO fonte_id FROM "ReservaSegundaChamada" WHERE id=reserva_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Decisão exige reserva existente'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
  PERFORM bloquear_contexto_fonte_segunda_chamada(fonte_id);
  PERFORM id FROM "PropostaSubstituicaoAgendaSegundaChamada" WHERE id=NEW."propostaId" AND "reservaId"=reserva_id AND "encontroId"=encontro_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de substituição mudou durante a decisão'; END IF;
  PERFORM id FROM "EncontroAgenda" WHERE id=encontro_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Encontro da substituição não encontrado'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "00_bloquear_decisao_substituicao_agenda_segunda_chamada"
BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoSubstituicaoAgendaSegundaChamada"
FOR EACH ROW EXECUTE FUNCTION bloquear_decisao_substituicao_agenda_segunda_chamada();
