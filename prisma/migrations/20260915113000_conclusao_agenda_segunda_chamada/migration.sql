-- Q148: a realização persistida é a única fonte que conclui o encontro de
-- segunda chamada. Encontros ainda previstos permanecem editáveis até o
-- fluxo específico de cancelamento ou substituição.
CREATE FUNCTION preservar_conclusao_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.status='MINISTRADO' AND EXISTS (
    SELECT 1 FROM "AgendaSegundaChamada" agenda WHERE agenda."encontroId"=OLD.id
  ) THEN RAISE EXCEPTION 'Encontro de segunda chamada ministrado não pode ser apagado'; END IF;
  RETURN OLD;
 END IF;

 IF EXISTS (SELECT 1 FROM "AgendaSegundaChamada" agenda WHERE agenda."encontroId"=OLD.id) THEN
  IF OLD.status='MINISTRADO' THEN
   RAISE EXCEPTION 'Encontro de segunda chamada ministrado é imutável';
  END IF;
  IF NEW.status='MINISTRADO' THEN
   IF OLD.status='PREVISTO'
      AND (to_jsonb(OLD)-'status')=(to_jsonb(NEW)-'status')
      AND EXISTS (
        SELECT 1
        FROM "AgendaSegundaChamada" agenda
        JOIN "ReservaSegundaChamada" reserva ON reserva.id=agenda."reservaId"
        JOIN "RealizacaoSegundaChamada" realizacao ON realizacao."reservaId"=reserva.id
        WHERE agenda."encontroId"=OLD.id
          AND reserva.status='CONSUMIDA_REALIZACAO'
          AND realizacao."professorId" IS NOT DISTINCT FROM OLD."professorId"
          AND realizacao."realizadaEm">=OLD.inicio
          AND realizacao."realizadaEm"<OLD.fim
      ) THEN RETURN NEW; END IF;
   RAISE EXCEPTION 'Conclusão da segunda chamada exige realização correspondente';
  END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER preservar_conclusao_agenda_segunda_chamada
BEFORE UPDATE OR DELETE ON "EncontroAgenda"
FOR EACH ROW EXECUTE FUNCTION preservar_conclusao_agenda_segunda_chamada();

CREATE FUNCTION preservar_agenda_segunda_chamada_concluida() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (
  SELECT 1 FROM "RealizacaoSegundaChamada" realizacao
  WHERE realizacao."reservaId"=OLD."reservaId"
 ) THEN RAISE EXCEPTION 'Agenda de segunda chamada realizada é imutável'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER preservar_agenda_segunda_chamada_concluida
BEFORE UPDATE OR DELETE ON "AgendaSegundaChamada"
FOR EACH ROW EXECUTE FUNCTION preservar_agenda_segunda_chamada_concluida();

CREATE FUNCTION concluir_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE "EncontroAgenda" encontro
 SET status='MINISTRADO'
 FROM "AgendaSegundaChamada" agenda
 JOIN "ReservaSegundaChamada" reserva ON reserva.id=agenda."reservaId"
 WHERE agenda."encontroId"=encontro.id
   AND agenda."reservaId"=NEW."reservaId"
   AND reserva.status='CONSUMIDA_REALIZACAO'
   AND encontro.status='PREVISTO';
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Realização exige encontro previsto vinculado à reserva';
 END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER concluir_agenda_segunda_chamada
AFTER INSERT ON "RealizacaoSegundaChamada"
FOR EACH ROW EXECUTE FUNCTION concluir_agenda_segunda_chamada();
