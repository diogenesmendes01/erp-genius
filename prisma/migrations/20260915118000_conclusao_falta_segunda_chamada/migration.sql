-- A falta terminal da reserva encerra exclusivamente o encontro de segunda
-- chamada correspondente. Esta migração é separada da alteração do enum para
-- que o PostgreSQL possa usar o novo valor com segurança.
CREATE FUNCTION falta_agenda_segunda_chamada_valida(p_reserva_id TEXT, p_encontro_id TEXT)
RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT COALESCE(EXISTS (
  SELECT 1
  FROM "AgendaSegundaChamada" agenda
  JOIN "ReservaSegundaChamada" reserva ON reserva.id=agenda."reservaId"
  JOIN "OcorrenciaSegundaChamada" ocorrencia ON ocorrencia."reservaId"=reserva.id
  WHERE reserva.id=p_reserva_id
    AND agenda."encontroId"=p_encontro_id
    AND reserva.status='CONSUMIDA_FALTA'
    AND ocorrencia.status='CONSUMIDA_FALTA'
 ),false);
$$;

CREATE FUNCTION preservar_nao_realizado_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='NAO_REALIZADO'::"StatusEncontroAgenda" THEN
  IF NEW.finalidade<>'SEGUNDA_CHAMADA' THEN
   RAISE EXCEPTION 'Status não realizado é exclusivo de segunda chamada';
  END IF;
  IF TG_OP='INSERT' THEN
   RAISE EXCEPTION 'Encontro não realizado exige falta terminal vinculada';
  END IF;
  IF OLD.status<>'PREVISTO'::"StatusEncontroAgenda"
     OR (to_jsonb(OLD)-'status') IS DISTINCT FROM (to_jsonb(NEW)-'status')
     OR NOT EXISTS (
       SELECT 1
       FROM "AgendaSegundaChamada" agenda
       WHERE agenda."encontroId"=OLD.id
         AND falta_agenda_segunda_chamada_valida(agenda."reservaId",OLD.id)
     ) THEN
   RAISE EXCEPTION 'Encontro não realizado exige falta terminal exata';
  END IF;
 ELSIF TG_OP='UPDATE' AND OLD.status='NAO_REALIZADO'::"StatusEncontroAgenda" THEN
  RAISE EXCEPTION 'Encontro de segunda chamada não realizado é imutável';
 END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER preservar_nao_realizado_segunda_chamada
BEFORE INSERT OR UPDATE ON "EncontroAgenda"
FOR EACH ROW EXECUTE FUNCTION preservar_nao_realizado_segunda_chamada();

CREATE OR REPLACE FUNCTION preservar_conclusao_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.status='MINISTRADO' AND EXISTS (SELECT 1 FROM "AgendaSegundaChamada" agenda WHERE agenda."encontroId"=OLD.id) THEN RAISE EXCEPTION 'Encontro de segunda chamada ministrado não pode ser apagado'; END IF;
  IF OLD.status='NAO_REALIZADO' AND EXISTS (SELECT 1 FROM "AgendaSegundaChamada" agenda WHERE agenda."encontroId"=OLD.id) THEN RAISE EXCEPTION 'Encontro de segunda chamada não realizado não pode ser apagado'; END IF;
  IF OLD.status='CANCELADO' AND EXISTS (SELECT 1 FROM "AgendaSegundaChamada" agenda WHERE agenda."encontroId"=OLD.id AND cancelamento_agenda_segunda_chamada_aprovado_valido(agenda."reservaId",OLD.id)) THEN RAISE EXCEPTION 'Encontro de segunda chamada cancelado é imutável'; END IF;
  RETURN OLD;
 END IF;
 IF EXISTS (SELECT 1 FROM "AgendaSegundaChamada" agenda WHERE agenda."encontroId"=OLD.id) THEN
  IF OLD.status='MINISTRADO' THEN RAISE EXCEPTION 'Encontro de segunda chamada ministrado é imutável'; END IF;
  IF OLD.status='NAO_REALIZADO' THEN RAISE EXCEPTION 'Encontro de segunda chamada não realizado é imutável'; END IF;
  IF OLD.status='CANCELADO' AND EXISTS (SELECT 1 FROM "AgendaSegundaChamada" agenda WHERE agenda."encontroId"=OLD.id AND cancelamento_agenda_segunda_chamada_aprovado_valido(agenda."reservaId",OLD.id)) THEN RAISE EXCEPTION 'Encontro de segunda chamada cancelado é imutável'; END IF;
  IF NEW.status='MINISTRADO' THEN
   IF OLD.status='PREVISTO' AND (to_jsonb(OLD)-'status')=(to_jsonb(NEW)-'status') AND EXISTS (
    SELECT 1 FROM "AgendaSegundaChamada" agenda JOIN "ReservaSegundaChamada" reserva ON reserva.id=agenda."reservaId" JOIN "RealizacaoSegundaChamada" realizacao ON realizacao."reservaId"=reserva.id
    WHERE agenda."encontroId"=OLD.id AND reserva.status='CONSUMIDA_REALIZACAO' AND realizacao."professorId" IS NOT DISTINCT FROM OLD."professorId" AND realizacao."realizadaEm">=OLD.inicio AND realizacao."realizadaEm"<OLD.fim
   ) THEN RETURN NEW; END IF;
   RAISE EXCEPTION 'Conclusão da segunda chamada exige realização correspondente';
  END IF;
  IF NEW.status='CANCELADO' THEN
   IF OLD.status='PREVISTO' AND (to_jsonb(OLD)-'status')=(to_jsonb(NEW)-'status') AND EXISTS (SELECT 1 FROM "AgendaSegundaChamada" agenda WHERE agenda."encontroId"=OLD.id AND cancelamento_agenda_segunda_chamada_aprovado_valido(agenda."reservaId",OLD.id)) THEN RETURN NEW; END IF;
   RAISE EXCEPTION 'Cancelamento da segunda chamada exige decisão aprovada e ocorrência correspondente';
  END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION preservar_agenda_segunda_chamada_concluida() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM "RealizacaoSegundaChamada" realizacao WHERE realizacao."reservaId"=OLD."reservaId")
   OR falta_agenda_segunda_chamada_valida(OLD."reservaId",OLD."encontroId")
   OR cancelamento_agenda_segunda_chamada_aprovado_valido(OLD."reservaId",OLD."encontroId") THEN
  RAISE EXCEPTION 'Agenda de segunda chamada encerrada é imutável';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION concluir_falta_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status<>'CONSUMIDA_FALTA'::"StatusReservaSegundaChamada" THEN RETURN NEW; END IF;
 UPDATE "EncontroAgenda" encontro
 SET status='NAO_REALIZADO'::"StatusEncontroAgenda"
 FROM "AgendaSegundaChamada" agenda
 JOIN "ReservaSegundaChamada" reserva ON reserva.id=agenda."reservaId"
 WHERE agenda."encontroId"=encontro.id
   AND agenda."reservaId"=NEW."reservaId"
   AND reserva.status='CONSUMIDA_FALTA'
   AND encontro.status='PREVISTO'::"StatusEncontroAgenda";
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Falta exige encontro previsto vinculado à reserva';
 END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER concluir_falta_agenda_segunda_chamada
AFTER INSERT ON "OcorrenciaSegundaChamada"
FOR EACH ROW EXECUTE FUNCTION concluir_falta_agenda_segunda_chamada();
