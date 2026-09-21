-- Q21/Q148: decisão usa a mesma ordem da action e dos demais guards:
-- reserva, calendário, depois a proposta imutável.
CREATE OR REPLACE FUNCTION conferir_cancelamento_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reserva "ReservaSegundaChamada"%ROWTYPE; proposta "PropostaCancelamentoAgendaSegundaChamada"%ROWTYPE;
        estado JSONB; agora TIMESTAMP; ator TEXT; reserva_id TEXT;
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

 SELECT "reservaId" INTO reserva_id FROM "PropostaCancelamentoAgendaSegundaChamada" WHERE id=NEW."propostaId";
 IF NOT FOUND THEN RAISE EXCEPTION 'Decisão exige proposta de cancelamento existente'; END IF;
 SELECT * INTO reserva FROM "ReservaSegundaChamada" WHERE id=reserva_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Decisão exige reserva de cancelamento existente'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 PERFORM agenda.id FROM "AgendaSegundaChamada" agenda JOIN "EncontroAgenda" encontro ON encontro.id=agenda."encontroId"
  WHERE agenda."reservaId"=reserva.id FOR SHARE OF agenda,encontro;
 SELECT * INTO proposta FROM "PropostaCancelamentoAgendaSegundaChamada" WHERE id=NEW."propostaId" FOR KEY SHARE;
 IF NOT FOUND OR proposta."reservaId" IS DISTINCT FROM reserva.id THEN RAISE EXCEPTION 'Decisão exige proposta de cancelamento existente'; END IF;
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
