-- Q21/Q148: cancelamento pela escola é uma decisão independente que preserva
-- a fonte, encerra a reserva e cancela o encontro na mesma transação.
CREATE TABLE "PropostaCancelamentoAgendaSegundaChamada" (
 "id" TEXT NOT NULL,
 "reservaId" TEXT NOT NULL,
 "autorId" TEXT NOT NULL,
 motivo TEXT NOT NULL,
 evidencia TEXT NOT NULL,
 "ocorridaEm" TIMESTAMP(3) NOT NULL,
 snapshot JSONB NOT NULL,
 "chaveIdempotencia" TEXT NOT NULL,
 "entradaHash" TEXT NOT NULL,
 "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),
 CONSTRAINT "PropostaCancelamentoAgendaSegundaChamada_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DecisaoCancelamentoAgendaSegundaChamada" (
 "id" TEXT NOT NULL,
 "propostaId" TEXT NOT NULL,
 "decisorId" TEXT NOT NULL,
 aprovada BOOLEAN NOT NULL,
 motivo TEXT NOT NULL,
 "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),
 CONSTRAINT "DecisaoCancelamentoAgendaSegundaChamada_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "OcorrenciaSegundaChamada" ADD COLUMN "propostaCancelamentoId" TEXT;
CREATE UNIQUE INDEX "PropostaCancelamentoAgendaSegundaChamada_autorId_chaveIdempotencia_key" ON "PropostaCancelamentoAgendaSegundaChamada"("autorId","chaveIdempotencia");
CREATE INDEX "PropostaCancelamentoAgendaSegundaChamada_reservaId_criadaEm_idx" ON "PropostaCancelamentoAgendaSegundaChamada"("reservaId","criadaEm");
CREATE UNIQUE INDEX "DecisaoCancelamentoAgendaSegundaChamada_propostaId_key" ON "DecisaoCancelamentoAgendaSegundaChamada"("propostaId");
CREATE UNIQUE INDEX "OcorrenciaSegundaChamada_propostaCancelamentoId_key" ON "OcorrenciaSegundaChamada"("propostaCancelamentoId");
ALTER TABLE "PropostaCancelamentoAgendaSegundaChamada" ADD CONSTRAINT "PropostaCancelamentoAgendaSegundaChamada_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "ReservaSegundaChamada"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "PropostaCancelamentoAgendaSegundaChamada" ADD CONSTRAINT "PropostaCancelamentoAgendaSegundaChamada_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoCancelamentoAgendaSegundaChamada" ADD CONSTRAINT "DecisaoCancelamentoAgendaSegundaChamada_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaCancelamentoAgendaSegundaChamada"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoCancelamentoAgendaSegundaChamada" ADD CONSTRAINT "DecisaoCancelamentoAgendaSegundaChamada_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "OcorrenciaSegundaChamada" ADD CONSTRAINT "OcorrenciaSegundaChamada_propostaCancelamentoId_fkey" FOREIGN KEY ("propostaCancelamentoId") REFERENCES "PropostaCancelamentoAgendaSegundaChamada"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION estado_cancelamento_agenda_segunda_chamada(reserva_id TEXT)
RETURNS JSONB LANGUAGE sql VOLATILE AS $$
 SELECT jsonb_build_object(
  'reserva',jsonb_build_object(
   'id',r.id,'propostaId',r."propostaId",'matriculaId',r."matriculaId",'regraId',r."regraId",'codigoAvaliacao',r."codigoAvaliacao",
   'status',r.status,'reservadaEm',r."reservadaEm",'regraCancelamentoMinutos',r."regraCancelamentoMinutos"
  ),
  'agenda',CASE WHEN a.id IS NULL THEN NULL ELSE jsonb_build_object('id',a.id,'encontroId',a."encontroId",'agendadaPorId',a."agendadaPorId",'criadaEm',a."criadaEm") END,
  'encontro',CASE WHEN e.id IS NULL THEN NULL ELSE jsonb_build_object(
   'id',e.id,'finalidade',e.finalidade,'status',e.status,'matriculaId',e."matriculaId",'turmaId',e."turmaId",'professorId',e."professorId",'inicio',e.inicio,'fim',e.fim,'fusoOrigem',e."fusoOrigem"
  ) END,
  'fatos',jsonb_build_object(
   'ocorrencia',CASE WHEN o.id IS NULL THEN NULL ELSE jsonb_build_object('id',o.id,'status',o.status,'ocorridaEm',o."ocorridaEm",'propostaCancelamentoId',o."propostaCancelamentoId") END,
   'realizacao',CASE WHEN sc.id IS NULL THEN NULL ELSE jsonb_build_object('id',sc.id,'professorId',sc."professorId",'realizadaEm',sc."realizadaEm") END
  )
 )
 FROM "ReservaSegundaChamada" r
 LEFT JOIN "AgendaSegundaChamada" a ON a."reservaId"=r.id
 LEFT JOIN "EncontroAgenda" e ON e.id=a."encontroId"
 LEFT JOIN "OcorrenciaSegundaChamada" o ON o."reservaId"=r.id
 LEFT JOIN "RealizacaoSegundaChamada" sc ON sc."reservaId"=r.id
 WHERE r.id=reserva_id;
$$;

CREATE FUNCTION conferir_cancelamento_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reserva "ReservaSegundaChamada"%ROWTYPE; proposta "PropostaCancelamentoAgendaSegundaChamada"%ROWTYPE;
        estado JSONB; agora TIMESTAMP; ator TEXT;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Proposta e decisão de cancelamento de segunda chamada são imutáveis'; END IF;
 IF TG_TABLE_NAME='PropostaCancelamentoAgendaSegundaChamada' THEN
  SELECT * INTO reserva FROM "ReservaSegundaChamada" WHERE id=NEW."reservaId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cancelamento exige reserva existente'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
  PERFORM agenda.id FROM "AgendaSegundaChamada" agenda JOIN "EncontroAgenda" encontro ON encontro.id=agenda."encontroId"
   WHERE agenda."reservaId"=reserva.id FOR SHARE OF agenda,encontro;
  ator:=NEW."autorId";
  agora:=clock_timestamp() AT TIME ZONE 'UTC';
  estado:=estado_cancelamento_agenda_segunda_chamada(reserva.id);
  IF reserva.status<>'RESERVADA' OR estado->'agenda' IS NULL OR estado->'agenda'='null'::jsonb OR estado->'encontro' IS NULL OR estado->'encontro'='null'::jsonb
    OR estado#>>'{encontro,finalidade}'<>'SEGUNDA_CHAMADA' OR estado#>>'{encontro,status}'<>'PREVISTO'
    OR estado#>'{fatos,ocorrencia}' IS DISTINCT FROM 'null'::jsonb OR estado#>'{fatos,realizacao}' IS DISTINCT FROM 'null'::jsonb THEN
   RAISE EXCEPTION 'Cancelamento exige segunda chamada prevista e reserva sem fato';
  END IF;
  IF NEW.snapshot IS DISTINCT FROM estado THEN RAISE EXCEPTION 'Confira o estado atual da agenda antes de cancelar'; END IF;
  IF NEW."ocorridaEm" IS NULL OR NOT isfinite(NEW."ocorridaEm") OR NOT isfinite(reserva."reservadaEm")
    OR NEW."ocorridaEm"<reserva."reservadaEm" OR NEW."ocorridaEm">agora THEN RAISE EXCEPTION 'Data do cancelamento inválida'; END IF;
  IF NEW.motivo IS NULL OR length(btrim(NEW.motivo))<5 OR length(NEW.motivo)>2000
    OR NEW.evidencia IS NULL OR length(btrim(NEW.evidencia))<5 OR length(NEW.evidencia)>4000
    OR NEW."chaveIdempotencia" IS NULL OR length(NEW."chaveIdempotencia")<8 OR length(NEW."chaveIdempotencia")>100
    OR NEW."entradaHash" IS NULL OR NEW."entradaHash" !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Conteúdo do cancelamento inválido'; END IF;
  PERFORM id FROM "Usuario" WHERE id=ator AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cancelamento exige gestão ativa'; END IF;
  NEW."criadaEm":=agora;
  RETURN NEW;
 END IF;

 SELECT * INTO proposta FROM "PropostaCancelamentoAgendaSegundaChamada" WHERE id=NEW."propostaId" FOR KEY SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Decisão exige proposta de cancelamento existente'; END IF;
 SELECT * INTO reserva FROM "ReservaSegundaChamada" WHERE id=proposta."reservaId" FOR UPDATE;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 PERFORM agenda.id FROM "AgendaSegundaChamada" agenda JOIN "EncontroAgenda" encontro ON encontro.id=agenda."encontroId"
  WHERE agenda."reservaId"=reserva.id FOR SHARE OF agenda,encontro;
 ator:=NEW."decisorId"; agora:=clock_timestamp() AT TIME ZONE 'UTC';
 PERFORM id FROM "Usuario" WHERE id=ator AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND OR ator=proposta."autorId" THEN RAISE EXCEPTION 'Decisão exige gestão ativa e independente'; END IF;
 IF NEW.motivo IS NULL OR length(btrim(NEW.motivo))<5 OR length(NEW.motivo)>2000 THEN RAISE EXCEPTION 'Motivo da decisão inválido'; END IF;
 IF NEW.aprovada THEN
  estado:=estado_cancelamento_agenda_segunda_chamada(reserva.id);
  IF proposta.snapshot IS DISTINCT FROM estado OR reserva.status<>'RESERVADA' OR estado->'agenda' IS NULL OR estado->'agenda'='null'::jsonb OR estado->'encontro' IS NULL OR estado->'encontro'='null'::jsonb OR estado#>>'{encontro,status}'<>'PREVISTO'
    OR estado#>'{fatos,ocorrencia}' IS DISTINCT FROM 'null'::jsonb OR estado#>'{fatos,realizacao}' IS DISTINCT FROM 'null'::jsonb THEN
   RAISE EXCEPTION 'A agenda mudou; prepare novo cancelamento';
  END IF;
 END IF;
 NEW."criadaEm":=agora;
 RETURN NEW;
END $$;

CREATE TRIGGER conferir_cancelamento_agenda_segunda_chamada_proposta
BEFORE INSERT OR UPDATE OR DELETE ON "PropostaCancelamentoAgendaSegundaChamada"
FOR EACH ROW EXECUTE FUNCTION conferir_cancelamento_agenda_segunda_chamada();
CREATE TRIGGER conferir_cancelamento_agenda_segunda_chamada_decisao
BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoCancelamentoAgendaSegundaChamada"
FOR EACH ROW EXECUTE FUNCTION conferir_cancelamento_agenda_segunda_chamada();

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
 IF NEW.status='LIBERADA_CANCELAMENTO_ESCOLA' THEN
  IF NEW."propostaCancelamentoId" IS NULL OR NOT EXISTS (
   SELECT 1 FROM "PropostaCancelamentoAgendaSegundaChamada" proposta
   JOIN "DecisaoCancelamentoAgendaSegundaChamada" decisao ON decisao."propostaId"=proposta.id AND decisao.aprovada
   WHERE proposta.id=NEW."propostaCancelamentoId" AND proposta."reservaId"=reserva.id
     AND NEW."registradaPorId"=decisao."decisorId" AND NEW."ocorridaEm"=proposta."ocorridaEm"
     AND NEW.motivo=proposta.motivo AND NEW.evidencia=proposta.evidencia
  ) THEN RAISE EXCEPTION 'Cancelamento pela escola exige decisão aprovada exata'; END IF;
 ELSIF NEW."propostaCancelamentoId" IS NOT NULL THEN RAISE EXCEPTION 'Origem de cancelamento escolar incompatível'; END IF;
 IF NEW.status NOT IN ('LIBERADA_CANCELAMENTO_ESCOLA','LIBERADA_CANCELAMENTO_TEMPESTIVO','CONSUMIDA_FALTA','CONSUMIDA_CANCELAMENTO_TARDIO','PENDENCIA_ESCOLA') OR NEW.status IS DISTINCT FROM reserva.status THEN RAISE EXCEPTION 'Status da ocorrência incompatível com a reserva'; END IF;
 IF NEW."ocorridaEm" IS NULL OR NOT isfinite(NEW."ocorridaEm") OR NOT isfinite(reserva."reservadaEm") OR NEW."ocorridaEm">agora OR NEW."ocorridaEm"<reserva."reservadaEm" THEN RAISE EXCEPTION 'Data da ocorrência inválida'; END IF;
 IF NEW.motivo IS NULL OR length(btrim(NEW.motivo))<5 OR length(NEW.motivo)>2000 OR NEW.evidencia IS NULL OR length(btrim(NEW.evidencia))<5 OR length(NEW.evidencia)>4000 THEN RAISE EXCEPTION 'Conteúdo da ocorrência inválido'; END IF;
 IF NEW.status='CONSUMIDA_FALTA' AND (inicio_agendado IS NULL OR NEW."ocorridaEm"<inicio_agendado) THEN RAISE EXCEPTION 'Falta exige início agendado já alcançado'; END IF;
 IF NEW.status='LIBERADA_CANCELAMENTO_TEMPESTIVO' AND (inicio_agendado IS NULL OR NEW."ocorridaEm">inicio_agendado-reserva."regraCancelamentoMinutos"*interval '1 minute') THEN RAISE EXCEPTION 'Cancelamento não respeita a antecedência contratada'; END IF;
 IF NEW.status='CONSUMIDA_CANCELAMENTO_TARDIO' AND inicio_agendado IS NOT NULL AND NEW."ocorridaEm"<=inicio_agendado-reserva."regraCancelamentoMinutos"*interval '1 minute' THEN RAISE EXCEPTION 'Cancelamento deveria ser tempestivo pela regra contratada'; END IF;
 IF EXISTS (SELECT 1 FROM "OcorrenciaSegundaChamada" WHERE "reservaId"=reserva.id FOR KEY SHARE) OR EXISTS (SELECT 1 FROM "RealizacaoSegundaChamada" WHERE "reservaId"=reserva.id FOR KEY SHARE) THEN RAISE EXCEPTION 'Reserva já possui fato terminal'; END IF;
 NEW."criadaEm":=agora;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION preservar_conclusao_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.status='MINISTRADO' AND EXISTS (SELECT 1 FROM "AgendaSegundaChamada" agenda WHERE agenda."encontroId"=OLD.id) THEN RAISE EXCEPTION 'Encontro de segunda chamada ministrado não pode ser apagado'; END IF;
  IF OLD.status='CANCELADO' AND EXISTS (
   SELECT 1 FROM "AgendaSegundaChamada" agenda JOIN "ReservaSegundaChamada" reserva ON reserva.id=agenda."reservaId"
   JOIN "OcorrenciaSegundaChamada" ocorrencia ON ocorrencia."reservaId"=reserva.id AND ocorrencia.status='LIBERADA_CANCELAMENTO_ESCOLA'
   JOIN "PropostaCancelamentoAgendaSegundaChamada" proposta ON proposta.id=ocorrencia."propostaCancelamentoId" AND proposta."reservaId"=reserva.id
   JOIN "DecisaoCancelamentoAgendaSegundaChamada" decisao ON decisao."propostaId"=proposta.id AND decisao.aprovada
   WHERE agenda."encontroId"=OLD.id AND reserva.status='LIBERADA_CANCELAMENTO_ESCOLA'
  ) THEN RAISE EXCEPTION 'Encontro de segunda chamada cancelado é imutável'; END IF;
  RETURN OLD;
 END IF;
 IF EXISTS (SELECT 1 FROM "AgendaSegundaChamada" agenda WHERE agenda."encontroId"=OLD.id) THEN
  IF OLD.status='MINISTRADO' THEN RAISE EXCEPTION 'Encontro de segunda chamada ministrado é imutável'; END IF;
  IF OLD.status='CANCELADO' AND EXISTS (
   SELECT 1 FROM "AgendaSegundaChamada" agenda JOIN "ReservaSegundaChamada" reserva ON reserva.id=agenda."reservaId"
   JOIN "OcorrenciaSegundaChamada" ocorrencia ON ocorrencia."reservaId"=reserva.id AND ocorrencia.status='LIBERADA_CANCELAMENTO_ESCOLA'
   JOIN "PropostaCancelamentoAgendaSegundaChamada" proposta ON proposta.id=ocorrencia."propostaCancelamentoId" AND proposta."reservaId"=reserva.id
   JOIN "DecisaoCancelamentoAgendaSegundaChamada" decisao ON decisao."propostaId"=proposta.id AND decisao.aprovada
   WHERE agenda."encontroId"=OLD.id AND reserva.status='LIBERADA_CANCELAMENTO_ESCOLA'
  ) THEN RAISE EXCEPTION 'Encontro de segunda chamada cancelado é imutável'; END IF;
  IF NEW.status='MINISTRADO' THEN
   IF OLD.status='PREVISTO' AND (to_jsonb(OLD)-'status')=(to_jsonb(NEW)-'status') AND EXISTS (
    SELECT 1 FROM "AgendaSegundaChamada" agenda JOIN "ReservaSegundaChamada" reserva ON reserva.id=agenda."reservaId" JOIN "RealizacaoSegundaChamada" realizacao ON realizacao."reservaId"=reserva.id
    WHERE agenda."encontroId"=OLD.id AND reserva.status='CONSUMIDA_REALIZACAO' AND realizacao."professorId" IS NOT DISTINCT FROM OLD."professorId" AND realizacao."realizadaEm">=OLD.inicio AND realizacao."realizadaEm"<OLD.fim
   ) THEN RETURN NEW; END IF;
   RAISE EXCEPTION 'Conclusão da segunda chamada exige realização correspondente';
  END IF;
  IF NEW.status='CANCELADO' THEN
   IF OLD.status='PREVISTO' AND (to_jsonb(OLD)-'status')=(to_jsonb(NEW)-'status') AND EXISTS (
    SELECT 1 FROM "AgendaSegundaChamada" agenda JOIN "ReservaSegundaChamada" reserva ON reserva.id=agenda."reservaId"
    JOIN "OcorrenciaSegundaChamada" ocorrencia ON ocorrencia."reservaId"=reserva.id AND ocorrencia.status='LIBERADA_CANCELAMENTO_ESCOLA'
    JOIN "PropostaCancelamentoAgendaSegundaChamada" proposta ON proposta.id=ocorrencia."propostaCancelamentoId" AND proposta."reservaId"=reserva.id
    JOIN "DecisaoCancelamentoAgendaSegundaChamada" decisao ON decisao."propostaId"=proposta.id AND decisao.aprovada
    WHERE agenda."encontroId"=OLD.id AND reserva.status='LIBERADA_CANCELAMENTO_ESCOLA'
   ) THEN RETURN NEW; END IF;
   RAISE EXCEPTION 'Cancelamento da segunda chamada exige decisão aprovada e ocorrência correspondente';
  END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION preservar_agenda_segunda_chamada_concluida() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM "RealizacaoSegundaChamada" realizacao WHERE realizacao."reservaId"=OLD."reservaId")
   OR EXISTS (SELECT 1 FROM "OcorrenciaSegundaChamada" ocorrencia WHERE ocorrencia."reservaId"=OLD."reservaId" AND ocorrencia."propostaCancelamentoId" IS NOT NULL) THEN
  RAISE EXCEPTION 'Agenda de segunda chamada encerrada é imutável';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION aplicar_cancelamento_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaCancelamentoAgendaSegundaChamada"%ROWTYPE; reserva "ReservaSegundaChamada"%ROWTYPE; agora TIMESTAMP;
BEGIN
 IF NOT NEW.aprovada THEN RETURN NEW; END IF;
 SELECT * INTO proposta FROM "PropostaCancelamentoAgendaSegundaChamada" WHERE id=NEW."propostaId" FOR KEY SHARE;
 SELECT * INTO reserva FROM "ReservaSegundaChamada" WHERE id=proposta."reservaId" FOR UPDATE;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 PERFORM agenda.id FROM "AgendaSegundaChamada" agenda JOIN "EncontroAgenda" encontro ON encontro.id=agenda."encontroId"
  WHERE agenda."reservaId"=reserva.id FOR SHARE OF agenda,encontro;
 agora:=clock_timestamp() AT TIME ZONE 'UTC';
 IF reserva.status<>'RESERVADA' OR proposta.snapshot IS DISTINCT FROM estado_cancelamento_agenda_segunda_chamada(reserva.id) THEN RAISE EXCEPTION 'A agenda mudou antes do cancelamento aprovado'; END IF;
 UPDATE "ReservaSegundaChamada" SET status='LIBERADA_CANCELAMENTO_ESCOLA' WHERE id=reserva.id AND status='RESERVADA';
 IF NOT FOUND THEN RAISE EXCEPTION 'Reserva mudou antes do cancelamento aprovado'; END IF;
 INSERT INTO "OcorrenciaSegundaChamada" (id,"reservaId","registradaPorId",status,"ocorridaEm",motivo,evidencia,"propostaCancelamentoId")
 VALUES ('cancelamento-segunda:'||NEW.id,reserva.id,NEW."decisorId",'LIBERADA_CANCELAMENTO_ESCOLA',proposta."ocorridaEm",proposta.motivo,proposta.evidencia,proposta.id);
 UPDATE "EncontroAgenda" encontro SET status='CANCELADO'
 FROM "AgendaSegundaChamada" agenda
 WHERE agenda."encontroId"=encontro.id AND agenda."reservaId"=reserva.id AND encontro.status='PREVISTO';
 IF NOT FOUND THEN RAISE EXCEPTION 'Encontro mudou antes do cancelamento aprovado'; END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER aplicar_cancelamento_agenda_segunda_chamada
AFTER INSERT ON "DecisaoCancelamentoAgendaSegundaChamada"
FOR EACH ROW EXECUTE FUNCTION aplicar_cancelamento_agenda_segunda_chamada();
