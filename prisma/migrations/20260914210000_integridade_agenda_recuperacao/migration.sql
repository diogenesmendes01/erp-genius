-- Nenhum caminho genérico pode apagar, deslocar ou reatribuir a agenda aprovada.
CREATE OR REPLACE FUNCTION preservar_finalidade_encontro() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaAgendaRecuperacao"%ROWTYPE; contrato TEXT;
BEGIN
 IF TG_OP='UPDATE' AND NEW.finalidade<>OLD.finalidade THEN RAISE EXCEPTION 'Finalidade do encontro é imutável'; END IF;
 IF TG_OP='UPDATE' AND OLD."propostaAgendaRecuperacaoId" IS NOT NULL THEN
  IF OLD.status='PREVISTO' AND NEW.status='MINISTRADO' AND (to_jsonb(OLD)-'status')=(to_jsonb(NEW)-'status') AND EXISTS (
   SELECT 1 FROM "PropostaAgendaRecuperacao" p JOIN "RealizacaoRecuperacao" r ON r."itemReservaId"=p."itemReservaId" WHERE p.id=OLD."propostaAgendaRecuperacaoId" AND r."professorId"=OLD."professorId" AND r."realizadaEm">=OLD.inicio AND r."realizadaEm"<OLD.fim
  ) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Agenda de recuperação aprovada é imutável fora do fluxo específico';
 END IF;
 IF NEW.finalidade='AULA' AND NEW."propostaAgendaRecuperacaoId" IS NOT NULL THEN RAISE EXCEPTION 'Origem de recuperação não corresponde a aula'; END IF;
 IF NEW.finalidade='RECUPERACAO' AND (NEW.status<>'RASCUNHO' OR NEW."propostaAgendaRecuperacaoId" IS NOT NULL) THEN
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Publicação de recuperação exige o fluxo específico de aprovação'; END IF;
  SELECT * INTO p FROM "PropostaAgendaRecuperacao" WHERE id=NEW."propostaAgendaRecuperacaoId";
  SELECT pl."matriculaId" INTO contrato FROM "ItemReservaTentativaRecuperacao" i JOIN "ReservaTentativaRecuperacao" r ON r.id=i."reservaId" JOIN "PropostaPlanoRecuperacao" pl ON pl.id=r."propostaId" WHERE i.id=p."itemReservaId";
  IF p.id IS NULL OR NOT EXISTS (SELECT 1 FROM "DecisaoAgendaRecuperacao" WHERE "propostaId"=p.id AND aprovada) OR NEW.status<>'PREVISTO' OR NEW."matriculaId" IS DISTINCT FROM contrato OR NEW."professorId" IS DISTINCT FROM p.snapshot->'professor'->>'id' OR NEW.inicio<>p.inicio OR NEW.fim<>p.fim OR NEW."fusoOrigem"<>p."fusoOrigem" OR NEW."preparadorId"<>p."autorId" THEN RAISE EXCEPTION 'Publicação de recuperação exige o fluxo específico de aprovação'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION impedir_exclusao_agenda_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."propostaAgendaRecuperacaoId" IS NOT NULL THEN RAISE EXCEPTION 'Agenda de recuperação aprovada não pode ser apagada'; END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER impedir_exclusao_agenda_recuperacao BEFORE DELETE ON "EncontroAgenda" FOR EACH ROW EXECUTE FUNCTION impedir_exclusao_agenda_recuperacao();

CREATE FUNCTION proteger_tentativa_agendada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE item TEXT; reserva TEXT;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 item:=to_jsonb(NEW)->>'itemReservaId'; reserva:=to_jsonb(NEW)->>'reservaId';
 IF EXISTS (SELECT 1 FROM "PropostaAgendaRecuperacao" p JOIN "EncontroAgenda" e ON e."propostaAgendaRecuperacaoId"=p.id JOIN "ItemReservaTentativaRecuperacao" i ON i.id=p."itemReservaId"
  WHERE (i.id=item OR i."reservaId"=reserva) AND e.status='PREVISTO') THEN RAISE EXCEPTION 'Tentativa agendada exige revisão específica da agenda aprovada'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER a_proteger_tentativa_agendada BEFORE INSERT ON "DesignacaoRecuperacao" FOR EACH ROW EXECUTE FUNCTION proteger_tentativa_agendada();
CREATE TRIGGER a_proteger_tentativa_agendada BEFORE INSERT ON "CancelamentoReservaRecuperacao" FOR EACH ROW EXECUTE FUNCTION proteger_tentativa_agendada();
CREATE TRIGGER a_proteger_tentativa_agendada BEFORE INSERT ON "PropostaAgendaRecuperacao" FOR EACH ROW EXECUTE FUNCTION proteger_tentativa_agendada();

CREATE FUNCTION conferir_realizacao_agendada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e "EncontroAgenda"%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT en.* INTO e FROM "EncontroAgenda" en JOIN "PropostaAgendaRecuperacao" p ON p.id=en."propostaAgendaRecuperacaoId" WHERE p."itemReservaId"=NEW."itemReservaId";
 IF e.id IS NOT NULL AND (e.status<>'PREVISTO' OR NEW."professorId" IS DISTINCT FROM e."professorId" OR NEW."realizadaEm"<e.inicio OR NEW."realizadaEm">=e.fim) THEN RAISE EXCEPTION 'Realização diverge da agenda aprovada'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER a_conferir_realizacao_agendada BEFORE INSERT ON "RealizacaoRecuperacao" FOR EACH ROW EXECUTE FUNCTION conferir_realizacao_agendada();
CREATE FUNCTION concluir_agenda_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE "EncontroAgenda" SET status='MINISTRADO' WHERE "propostaAgendaRecuperacaoId" IN (SELECT id FROM "PropostaAgendaRecuperacao" WHERE "itemReservaId"=NEW."itemReservaId");
 RETURN NEW;
END $$;
CREATE TRIGGER concluir_agenda_recuperacao AFTER INSERT ON "RealizacaoRecuperacao" FOR EACH ROW EXECUTE FUNCTION concluir_agenda_recuperacao();
