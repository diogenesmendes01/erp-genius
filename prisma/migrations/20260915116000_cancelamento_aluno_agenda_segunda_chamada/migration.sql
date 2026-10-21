-- Q21/Q148: aluno também cancela somente por proposta e decisão independentes;
-- a consequência usa a antecedência congelada na reserva.
ALTER TABLE "PropostaCancelamentoAgendaSegundaChamada"
 ADD COLUMN origem TEXT NOT NULL DEFAULT 'ESCOLA';
ALTER TABLE "PropostaCancelamentoAgendaSegundaChamada"
 ADD CONSTRAINT "PropostaCancelamentoAgendaSegundaChamada_origem_check" CHECK (origem IN ('ESCOLA','ALUNO'));

CREATE FUNCTION conferir_origem_cancelamento_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.origem NOT IN ('ESCOLA','ALUNO') THEN RAISE EXCEPTION 'Origem do cancelamento inválida'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_origem_cancelamento_agenda_segunda_chamada
BEFORE INSERT ON "PropostaCancelamentoAgendaSegundaChamada"
FOR EACH ROW EXECUTE FUNCTION conferir_origem_cancelamento_agenda_segunda_chamada();

CREATE FUNCTION cancelamento_agenda_segunda_chamada_aprovado_valido(p_reserva_id TEXT, p_encontro_id TEXT)
RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT COALESCE(EXISTS (
  SELECT 1
  FROM "AgendaSegundaChamada" agenda
  JOIN "ReservaSegundaChamada" reserva ON reserva.id=agenda."reservaId"
  JOIN "EncontroAgenda" encontro ON encontro.id=agenda."encontroId"
  JOIN "OcorrenciaSegundaChamada" ocorrencia ON ocorrencia."reservaId"=reserva.id
  JOIN "PropostaCancelamentoAgendaSegundaChamada" proposta ON proposta.id=ocorrencia."propostaCancelamentoId" AND proposta."reservaId"=reserva.id
  JOIN "DecisaoCancelamentoAgendaSegundaChamada" decisao ON decisao."propostaId"=proposta.id AND decisao.aprovada
  WHERE reserva.id=p_reserva_id
    AND (p_encontro_id IS NULL OR agenda."encontroId"=p_encontro_id)
    AND reserva.status=ocorrencia.status
    AND ocorrencia."registradaPorId"=decisao."decisorId" AND ocorrencia."ocorridaEm"=proposta."ocorridaEm"
    AND ocorrencia.motivo=proposta.motivo AND ocorrencia.evidencia=proposta.evidencia
    AND ((proposta.origem='ESCOLA' AND ocorrencia.status='LIBERADA_CANCELAMENTO_ESCOLA')
      OR (proposta.origem='ALUNO' AND ocorrencia.status=CASE WHEN proposta."ocorridaEm"<=encontro.inicio-reserva."regraCancelamentoMinutos"*interval '1 minute' THEN 'LIBERADA_CANCELAMENTO_TEMPESTIVO'::"StatusReservaSegundaChamada" ELSE 'CONSUMIDA_CANCELAMENTO_TARDIO'::"StatusReservaSegundaChamada" END))
 ),false);
$$;

CREATE OR REPLACE FUNCTION preservar_ocorrencia_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reserva "ReservaSegundaChamada"%ROWTYPE; inicio_agendado TIMESTAMP; agora TIMESTAMP;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Ocorrência de segunda chamada é imutável'; END IF;
 SELECT * INTO reserva FROM "ReservaSegundaChamada" WHERE id=NEW."reservaId" FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ocorrência exige reserva existente'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT e.inicio INTO inicio_agendado FROM "AgendaSegundaChamada" agenda JOIN "EncontroAgenda" e ON e.id=agenda."encontroId" WHERE agenda."reservaId"=reserva.id FOR SHARE OF agenda,e;
 PERFORM id FROM "Usuario" WHERE id=NEW."registradaPorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ocorrência exige gestão ativa'; END IF;
 agora:=clock_timestamp() AT TIME ZONE 'UTC';
 IF NEW.status IN ('LIBERADA_CANCELAMENTO_ESCOLA','LIBERADA_CANCELAMENTO_TEMPESTIVO','CONSUMIDA_CANCELAMENTO_TARDIO') THEN
  IF NEW."propostaCancelamentoId" IS NULL OR NOT EXISTS (
   SELECT 1 FROM "PropostaCancelamentoAgendaSegundaChamada" proposta
   JOIN "DecisaoCancelamentoAgendaSegundaChamada" decisao ON decisao."propostaId"=proposta.id AND decisao.aprovada
   JOIN "AgendaSegundaChamada" agenda ON agenda."reservaId"=reserva.id
   JOIN "EncontroAgenda" encontro ON encontro.id=agenda."encontroId"
   WHERE proposta.id=NEW."propostaCancelamentoId" AND proposta."reservaId"=reserva.id
     AND NEW."registradaPorId"=decisao."decisorId" AND NEW."ocorridaEm"=proposta."ocorridaEm"
     AND NEW.motivo=proposta.motivo AND NEW.evidencia=proposta.evidencia
     AND ((proposta.origem='ESCOLA' AND NEW.status='LIBERADA_CANCELAMENTO_ESCOLA')
       OR (proposta.origem='ALUNO' AND NEW.status=CASE WHEN proposta."ocorridaEm"<=encontro.inicio-reserva."regraCancelamentoMinutos"*interval '1 minute' THEN 'LIBERADA_CANCELAMENTO_TEMPESTIVO'::"StatusReservaSegundaChamada" ELSE 'CONSUMIDA_CANCELAMENTO_TARDIO'::"StatusReservaSegundaChamada" END))
  ) THEN
   RAISE EXCEPTION 'Cancelamento exige decisão aprovada exata';
  END IF;
 ELSIF NEW."propostaCancelamentoId" IS NOT NULL THEN RAISE EXCEPTION 'Origem de cancelamento incompatível'; END IF;
 IF NEW.status NOT IN ('LIBERADA_CANCELAMENTO_ESCOLA','LIBERADA_CANCELAMENTO_TEMPESTIVO','CONSUMIDA_FALTA','CONSUMIDA_CANCELAMENTO_TARDIO','PENDENCIA_ESCOLA') OR NEW.status IS DISTINCT FROM reserva.status THEN RAISE EXCEPTION 'Status da ocorrência incompatível com a reserva'; END IF;
 IF NEW."ocorridaEm" IS NULL OR NOT isfinite(NEW."ocorridaEm") OR NOT isfinite(reserva."reservadaEm") OR NEW."ocorridaEm">agora OR NEW."ocorridaEm"<reserva."reservadaEm" THEN RAISE EXCEPTION 'Data da ocorrência inválida'; END IF;
 IF NEW.motivo IS NULL OR length(btrim(NEW.motivo))<5 OR length(NEW.motivo)>2000 OR NEW.evidencia IS NULL OR length(btrim(NEW.evidencia))<5 OR length(NEW.evidencia)>4000 THEN RAISE EXCEPTION 'Conteúdo da ocorrência inválido'; END IF;
 IF NEW.status='CONSUMIDA_FALTA' AND (inicio_agendado IS NULL OR NEW."ocorridaEm"<inicio_agendado) THEN RAISE EXCEPTION 'Falta exige início agendado já alcançado'; END IF;
 IF EXISTS (SELECT 1 FROM "OcorrenciaSegundaChamada" WHERE "reservaId"=reserva.id FOR KEY SHARE) OR EXISTS (SELECT 1 FROM "RealizacaoSegundaChamada" WHERE "reservaId"=reserva.id FOR KEY SHARE) THEN RAISE EXCEPTION 'Reserva já possui fato terminal'; END IF;
 NEW."criadaEm":=agora;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION preservar_conclusao_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.status='MINISTRADO' AND EXISTS (SELECT 1 FROM "AgendaSegundaChamada" agenda WHERE agenda."encontroId"=OLD.id) THEN RAISE EXCEPTION 'Encontro de segunda chamada ministrado não pode ser apagado'; END IF;
  IF OLD.status='CANCELADO' AND EXISTS (SELECT 1 FROM "AgendaSegundaChamada" agenda WHERE agenda."encontroId"=OLD.id AND cancelamento_agenda_segunda_chamada_aprovado_valido(agenda."reservaId",OLD.id)) THEN RAISE EXCEPTION 'Encontro de segunda chamada cancelado é imutável'; END IF;
  RETURN OLD;
 END IF;
 IF EXISTS (SELECT 1 FROM "AgendaSegundaChamada" agenda WHERE agenda."encontroId"=OLD.id) THEN
  IF OLD.status='MINISTRADO' THEN RAISE EXCEPTION 'Encontro de segunda chamada ministrado é imutável'; END IF;
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
   OR cancelamento_agenda_segunda_chamada_aprovado_valido(OLD."reservaId",OLD."encontroId") THEN
  RAISE EXCEPTION 'Agenda de segunda chamada encerrada é imutável';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION aplicar_cancelamento_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaCancelamentoAgendaSegundaChamada"%ROWTYPE; reserva "ReservaSegundaChamada"%ROWTYPE; inicio_agendado TIMESTAMP; status_cancelamento "StatusReservaSegundaChamada";
BEGIN
 IF NOT NEW.aprovada THEN RETURN NEW; END IF;
 SELECT * INTO proposta FROM "PropostaCancelamentoAgendaSegundaChamada" WHERE id=NEW."propostaId" FOR KEY SHARE;
 SELECT * INTO reserva FROM "ReservaSegundaChamada" WHERE id=proposta."reservaId" FOR UPDATE;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT encontro.inicio INTO inicio_agendado FROM "AgendaSegundaChamada" agenda JOIN "EncontroAgenda" encontro ON encontro.id=agenda."encontroId"
  WHERE agenda."reservaId"=reserva.id FOR SHARE OF agenda,encontro;
 IF inicio_agendado IS NULL OR reserva.status<>'RESERVADA' OR proposta.snapshot IS DISTINCT FROM estado_cancelamento_agenda_segunda_chamada(reserva.id) THEN RAISE EXCEPTION 'A agenda mudou antes do cancelamento aprovado'; END IF;
 status_cancelamento:=CASE WHEN proposta.origem='ESCOLA' THEN 'LIBERADA_CANCELAMENTO_ESCOLA'::"StatusReservaSegundaChamada"
   WHEN proposta.origem='ALUNO' AND proposta."ocorridaEm"<=inicio_agendado-reserva."regraCancelamentoMinutos"*interval '1 minute' THEN 'LIBERADA_CANCELAMENTO_TEMPESTIVO'::"StatusReservaSegundaChamada"
   WHEN proposta.origem='ALUNO' THEN 'CONSUMIDA_CANCELAMENTO_TARDIO'::"StatusReservaSegundaChamada"
   ELSE NULL END;
 IF status_cancelamento IS NULL THEN RAISE EXCEPTION 'Origem do cancelamento inválida'; END IF;
 UPDATE "ReservaSegundaChamada" SET status=status_cancelamento WHERE id=reserva.id AND status='RESERVADA';
 IF NOT FOUND THEN RAISE EXCEPTION 'Reserva mudou antes do cancelamento aprovado'; END IF;
 INSERT INTO "OcorrenciaSegundaChamada" (id,"reservaId","registradaPorId",status,"ocorridaEm",motivo,evidencia,"propostaCancelamentoId")
 VALUES ('cancelamento-segunda:'||NEW.id,reserva.id,NEW."decisorId",status_cancelamento,proposta."ocorridaEm",proposta.motivo,proposta.evidencia,proposta.id);
 UPDATE "EncontroAgenda" encontro SET status='CANCELADO' FROM "AgendaSegundaChamada" agenda
 WHERE agenda."encontroId"=encontro.id AND agenda."reservaId"=reserva.id AND encontro.status='PREVISTO';
 IF NOT FOUND THEN RAISE EXCEPTION 'Encontro mudou antes do cancelamento aprovado'; END IF;
 RETURN NEW;
END $$;
