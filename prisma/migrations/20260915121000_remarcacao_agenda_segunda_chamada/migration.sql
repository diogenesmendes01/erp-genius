-- Q21/Q148: esta etapa guarda proposta e decisão imutáveis de remarcação.
-- A decisão aprovada aplica a troca na mesma transação: preserva o encontro
-- anterior, cria o novo e religa a mesma AgendaSegundaChamada.
CREATE TABLE "PropostaRemarcacaoAgendaSegundaChamada" (
  "id" TEXT NOT NULL,
  "reservaId" TEXT NOT NULL,
  "autorId" TEXT NOT NULL,
  versao INTEGER NOT NULL,
  inicio TIMESTAMP(3) NOT NULL,
  fim TIMESTAMP(3) NOT NULL,
  "fusoOrigem" TEXT NOT NULL,
  motivo TEXT NOT NULL,
  evidencia TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  "entradaHash" TEXT NOT NULL,
  "chaveIdempotencia" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),
  CONSTRAINT "PropostaRemarcacaoAgendaSegundaChamada_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PropostaRemarcacaoAgendaSegundaChamada_versao_check" CHECK (versao > 0),
  CONSTRAINT "PropostaRemarcacaoAgendaSegundaChamada_intervalo_check" CHECK (isfinite(inicio) AND isfinite(fim) AND fim > inicio),
  CONSTRAINT "PropostaRemarcacaoAgendaSegundaChamada_fuso_check" CHECK (length(btrim("fusoOrigem")) > 0),
  CONSTRAINT "PropostaRemarcacaoAgendaSegundaChamada_motivo_check" CHECK (length(btrim(motivo)) BETWEEN 5 AND 2000),
  CONSTRAINT "PropostaRemarcacaoAgendaSegundaChamada_evidencia_check" CHECK (length(btrim(evidencia)) BETWEEN 5 AND 4000),
  CONSTRAINT "PropostaRemarcacaoAgendaSegundaChamada_chave_check" CHECK (length("chaveIdempotencia") BETWEEN 8 AND 100),
  CONSTRAINT "PropostaRemarcacaoAgendaSegundaChamada_hash_check" CHECK ("entradaHash" ~ '^[a-f0-9]{64}$')
);

CREATE TABLE "DecisaoRemarcacaoAgendaSegundaChamada" (
  "id" TEXT NOT NULL,
  "propostaId" TEXT NOT NULL,
  "decisorId" TEXT NOT NULL,
  aprovada BOOLEAN NOT NULL,
  motivo TEXT NOT NULL,
  "encontroNovoId" TEXT,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),
  CONSTRAINT "DecisaoRemarcacaoAgendaSegundaChamada_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DecisaoRemarcacaoAgendaSegundaChamada_motivo_check" CHECK (length(btrim(motivo)) BETWEEN 5 AND 2000)
);

CREATE TABLE "AplicacaoRemarcacaoAgendaSegundaChamada" (
  "id" TEXT NOT NULL,
  "decisaoId" TEXT NOT NULL,
  "encontroOriginalId" TEXT NOT NULL,
  "encontroNovoId" TEXT NOT NULL,
  "aplicadaEm" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),
  CONSTRAINT "AplicacaoRemarcacaoAgendaSegundaChamada_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PropostaRemarcacaoAgendaSegundaChamada_reservaId_versao_key"
  ON "PropostaRemarcacaoAgendaSegundaChamada"("reservaId", versao);
CREATE UNIQUE INDEX "PropostaRemarcacaoAgendaSegundaChamada_autorId_chaveIdempotencia_key"
  ON "PropostaRemarcacaoAgendaSegundaChamada"("autorId", "chaveIdempotencia");
CREATE INDEX "PropostaRemarcacaoAgendaSegundaChamada_reservaId_criadaEm_idx"
  ON "PropostaRemarcacaoAgendaSegundaChamada"("reservaId", "criadaEm");
CREATE UNIQUE INDEX "DecisaoRemarcacaoAgendaSegundaChamada_propostaId_key"
  ON "DecisaoRemarcacaoAgendaSegundaChamada"("propostaId");
CREATE UNIQUE INDEX "DecisaoRemarcacaoAgendaSegundaChamada_encontroNovoId_key"
  ON "DecisaoRemarcacaoAgendaSegundaChamada"("encontroNovoId");
CREATE UNIQUE INDEX "AplicacaoRemarcacaoAgendaSegundaChamada_decisaoId_key"
  ON "AplicacaoRemarcacaoAgendaSegundaChamada"("decisaoId");
CREATE UNIQUE INDEX "AplicacaoRemarcacaoAgendaSegundaChamada_encontroOriginalId_key"
  ON "AplicacaoRemarcacaoAgendaSegundaChamada"("encontroOriginalId");
CREATE UNIQUE INDEX "AplicacaoRemarcacaoAgendaSegundaChamada_encontroNovoId_key"
  ON "AplicacaoRemarcacaoAgendaSegundaChamada"("encontroNovoId");

ALTER TABLE "PropostaRemarcacaoAgendaSegundaChamada"
  ADD CONSTRAINT "PropostaRemarcacaoAgendaSegundaChamada_reservaId_fkey"
  FOREIGN KEY ("reservaId") REFERENCES "ReservaSegundaChamada"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "PropostaRemarcacaoAgendaSegundaChamada"
  ADD CONSTRAINT "PropostaRemarcacaoAgendaSegundaChamada_autorId_fkey"
  FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoRemarcacaoAgendaSegundaChamada"
  ADD CONSTRAINT "DecisaoRemarcacaoAgendaSegundaChamada_propostaId_fkey"
  FOREIGN KEY ("propostaId") REFERENCES "PropostaRemarcacaoAgendaSegundaChamada"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoRemarcacaoAgendaSegundaChamada"
  ADD CONSTRAINT "DecisaoRemarcacaoAgendaSegundaChamada_decisorId_fkey"
  FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoRemarcacaoAgendaSegundaChamada"
  ADD CONSTRAINT "DecisaoRemarcacaoAgendaSegundaChamada_encontroNovoId_fkey"
  FOREIGN KEY ("encontroNovoId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "AplicacaoRemarcacaoAgendaSegundaChamada"
  ADD CONSTRAINT "AplicacaoRemarcacaoAgendaSegundaChamada_decisaoId_fkey"
  FOREIGN KEY ("decisaoId") REFERENCES "DecisaoRemarcacaoAgendaSegundaChamada"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "AplicacaoRemarcacaoAgendaSegundaChamada"
  ADD CONSTRAINT "AplicacaoRemarcacaoAgendaSegundaChamada_encontroOriginalId_fkey"
  FOREIGN KEY ("encontroOriginalId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "AplicacaoRemarcacaoAgendaSegundaChamada"
  ADD CONSTRAINT "AplicacaoRemarcacaoAgendaSegundaChamada_encontroNovoId_fkey"
  FOREIGN KEY ("encontroNovoId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

COMMENT ON TABLE "PropostaRemarcacaoAgendaSegundaChamada" IS
  'Persistência somente: não remarca agenda nem encontro nesta etapa.';
COMMENT ON TABLE "DecisaoRemarcacaoAgendaSegundaChamada" IS
  'Aprovação aplica a remarcação atomica da mesma reserva e agenda.';
COMMENT ON TABLE "AplicacaoRemarcacaoAgendaSegundaChamada" IS
  'Fato imutável criado pelo trigger da decisão de remarcação aprovada.';

CREATE FUNCTION estado_remarcacao_agenda_segunda_chamada(p_reserva_id TEXT)
RETURNS JSONB LANGUAGE sql VOLATILE AS $$
  SELECT jsonb_build_object(
    'reserva', jsonb_build_object(
      'id', reserva.id,
      'propostaId', reserva."propostaId",
      'matriculaId', reserva."matriculaId",
      'regraId', reserva."regraId",
      'codigoAvaliacao', reserva."codigoAvaliacao",
      'status', reserva.status,
      'reservadaEm', reserva."reservadaEm",
      'regraCancelamentoMinutos', reserva."regraCancelamentoMinutos"
    ),
    'agenda', CASE WHEN agenda.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', agenda.id,
      'encontroId', agenda."encontroId",
      'agendadaPorId', agenda."agendadaPorId",
      'criadaEm', agenda."criadaEm"
    ) END,
    'encontro', CASE WHEN encontro.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', encontro.id,
      'finalidade', encontro.finalidade,
      'status', encontro.status,
      'matriculaId', encontro."matriculaId",
      'turmaId', encontro."turmaId",
      'professorId', encontro."professorId",
      'inicio', encontro.inicio,
      'fim', encontro.fim,
      'fusoOrigem', encontro."fusoOrigem"
    ) END,
    'fatos', jsonb_build_object(
      'ocorrencia', CASE WHEN ocorrencia.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', ocorrencia.id,
        'status', ocorrencia.status,
        'ocorridaEm', ocorrencia."ocorridaEm"
      ) END,
      'realizacao', CASE WHEN realizacao.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', realizacao.id,
        'professorId', realizacao."professorId",
        'realizadaEm', realizacao."realizadaEm"
      ) END
    )
  )
  FROM "ReservaSegundaChamada" reserva
  LEFT JOIN "AgendaSegundaChamada" agenda ON agenda."reservaId" = reserva.id
  LEFT JOIN "EncontroAgenda" encontro ON encontro.id = agenda."encontroId"
  LEFT JOIN "OcorrenciaSegundaChamada" ocorrencia ON ocorrencia."reservaId" = reserva.id
  LEFT JOIN "RealizacaoSegundaChamada" realizacao ON realizacao."reservaId" = reserva.id
  WHERE reserva.id = p_reserva_id;
$$;

CREATE FUNCTION conferir_remarcacao_agenda_segunda_chamada() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  reserva "ReservaSegundaChamada"%ROWTYPE;
  proposta "PropostaRemarcacaoAgendaSegundaChamada"%ROWTYPE;
  estado JSONB;
  agora TIMESTAMP;
  ator TEXT;
  reserva_id TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    IF TG_OP='UPDATE' AND TG_TABLE_NAME='DecisaoRemarcacaoAgendaSegundaChamada'
      AND pg_trigger_depth()>1 AND OLD."encontroNovoId" IS NULL AND NEW."encontroNovoId" IS NOT NULL
      AND (to_jsonb(OLD)-'encontroNovoId') IS NOT DISTINCT FROM (to_jsonb(NEW)-'encontroNovoId') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Proposta e decisão de remarcação de segunda chamada são imutáveis';
  END IF;

  IF TG_TABLE_NAME = 'PropostaRemarcacaoAgendaSegundaChamada' THEN
    SELECT * INTO reserva
    FROM "ReservaSegundaChamada"
    WHERE id = NEW."reservaId"
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Remarcação exige reserva existente';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
    PERFORM agenda.id
    FROM "AgendaSegundaChamada" agenda
    JOIN "EncontroAgenda" encontro ON encontro.id = agenda."encontroId"
    WHERE agenda."reservaId" = reserva.id
    FOR SHARE OF agenda, encontro;

    estado := estado_remarcacao_agenda_segunda_chamada(reserva.id);
    IF reserva.status <> 'RESERVADA'
      OR estado->'agenda' IS NULL OR estado->'agenda' = 'null'::jsonb
      OR estado->'encontro' IS NULL OR estado->'encontro' = 'null'::jsonb
      OR estado#>>'{encontro,finalidade}' <> 'SEGUNDA_CHAMADA'
      OR estado#>>'{encontro,status}' <> 'PREVISTO'
      OR estado#>'{fatos,ocorrencia}' IS DISTINCT FROM 'null'::jsonb
      OR estado#>'{fatos,realizacao}' IS DISTINCT FROM 'null'::jsonb THEN
      RAISE EXCEPTION 'Remarcação exige segunda chamada prevista e reserva sem fato';
    END IF;
    IF NEW.snapshot IS DISTINCT FROM estado THEN
      RAISE EXCEPTION 'Confira o estado atual da agenda antes de remarcar';
    END IF;
    IF NEW.inicio <= (clock_timestamp() AT TIME ZONE 'UTC') THEN
      RAISE EXCEPTION 'Remarcação exige horário futuro';
    END IF;

    ator := NEW."autorId";
    PERFORM id
    FROM "Usuario"
    WHERE id = ator
      AND ativo
      AND papeis && ARRAY['SECRETARIA_ACADEMICA', 'GERENTE_PEDAGOGICO', 'ADMINISTRADOR']::"Papel"[]
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Remarcação exige secretaria, gestão pedagógica ou administração ativa';
    END IF;

    IF NEW.versao <> COALESCE((
      SELECT MAX(versao)
      FROM "PropostaRemarcacaoAgendaSegundaChamada"
      WHERE "reservaId" = reserva.id
    ), 0) + 1 THEN
      RAISE EXCEPTION 'Versão da remarcação desatualizada';
    END IF;

    agora := clock_timestamp() AT TIME ZONE 'UTC';
    NEW."criadaEm" := agora;
    RETURN NEW;
  END IF;

  -- Ler a referência sem lock permite respeitar a ordem reserva -> calendário -> proposta.
  SELECT "reservaId" INTO reserva_id
  FROM "PropostaRemarcacaoAgendaSegundaChamada"
  WHERE id = NEW."propostaId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Decisão exige proposta de remarcação existente';
  END IF;

  SELECT * INTO reserva
  FROM "ReservaSegundaChamada"
  WHERE id = reserva_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Decisão exige reserva de remarcação existente';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  PERFORM agenda.id
  FROM "AgendaSegundaChamada" agenda
  JOIN "EncontroAgenda" encontro ON encontro.id = agenda."encontroId"
  WHERE agenda."reservaId" = reserva.id
  FOR SHARE OF agenda, encontro;

  SELECT * INTO proposta
  FROM "PropostaRemarcacaoAgendaSegundaChamada"
  WHERE id = NEW."propostaId"
  FOR KEY SHARE;
  IF NOT FOUND OR proposta."reservaId" IS DISTINCT FROM reserva.id THEN
    RAISE EXCEPTION 'Decisão exige proposta de remarcação existente';
  END IF;

  ator := NEW."decisorId";
  PERFORM id
  FROM "Usuario"
  WHERE id = ator
    AND ativo
    AND papeis && ARRAY['GERENTE_PEDAGOGICO', 'ADMINISTRADOR']::"Papel"[]
  FOR SHARE;
  IF NOT FOUND OR ator = proposta."autorId" THEN
    RAISE EXCEPTION 'Decisão exige gestão ativa e independente';
  END IF;

  IF NEW.motivo IS NULL OR length(btrim(NEW.motivo)) < 5 OR length(NEW.motivo) > 2000 THEN
    RAISE EXCEPTION 'Motivo da decisão inválido';
  END IF;

  IF NEW.aprovada THEN
    estado := estado_remarcacao_agenda_segunda_chamada(reserva.id);
    IF proposta.snapshot IS DISTINCT FROM estado
      OR reserva.status <> 'RESERVADA'
      OR estado->'agenda' IS NULL OR estado->'agenda' = 'null'::jsonb
      OR estado->'encontro' IS NULL OR estado->'encontro' = 'null'::jsonb
      OR estado#>>'{encontro,finalidade}' <> 'SEGUNDA_CHAMADA'
      OR estado#>>'{encontro,status}' <> 'PREVISTO'
      OR estado#>'{fatos,ocorrencia}' IS DISTINCT FROM 'null'::jsonb
      OR estado#>'{fatos,realizacao}' IS DISTINCT FROM 'null'::jsonb
      OR proposta.inicio <= (clock_timestamp() AT TIME ZONE 'UTC') THEN
      RAISE EXCEPTION 'A agenda ou o horário da remarcação exige nova proposta';
    END IF;
  END IF;

  agora := clock_timestamp() AT TIME ZONE 'UTC';
  NEW."criadaEm" := agora;
  RETURN NEW;
END $$;

CREATE TRIGGER conferir_remarcacao_agenda_segunda_chamada_proposta
BEFORE INSERT OR UPDATE OR DELETE ON "PropostaRemarcacaoAgendaSegundaChamada"
FOR EACH ROW EXECUTE FUNCTION conferir_remarcacao_agenda_segunda_chamada();

CREATE TRIGGER conferir_remarcacao_agenda_segunda_chamada_decisao
BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoRemarcacaoAgendaSegundaChamada"
FOR EACH ROW EXECUTE FUNCTION conferir_remarcacao_agenda_segunda_chamada();

CREATE FUNCTION conferir_aplicacao_remarcacao_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' OR pg_trigger_depth()<=1 THEN RAISE EXCEPTION 'Aplicação de remarcação é criada somente pela decisão atômica'; END IF;
 IF NEW."encontroOriginalId"=NEW."encontroNovoId" OR NOT EXISTS (SELECT 1 FROM "DecisaoRemarcacaoAgendaSegundaChamada" d WHERE d.id=NEW."decisaoId" AND d.aprovada) THEN RAISE EXCEPTION 'Aplicação exige decisão aprovada e encontro novo'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_aplicacao_remarcacao_agenda_segunda_chamada BEFORE INSERT OR UPDATE OR DELETE ON "AplicacaoRemarcacaoAgendaSegundaChamada" FOR EACH ROW EXECUTE FUNCTION conferir_aplicacao_remarcacao_agenda_segunda_chamada();

CREATE FUNCTION aplicar_remarcacao_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "ReservaSegundaChamada"%ROWTYPE; p "PropostaRemarcacaoAgendaSegundaChamada"%ROWTYPE; a "AgendaSegundaChamada"%ROWTYPE; e "EncontroAgenda"%ROWTYPE; novo TEXT; agora TIMESTAMP;
BEGIN
 IF NOT NEW.aprovada THEN RETURN NEW; END IF;
 SELECT p0."reservaId" INTO r.id FROM "PropostaRemarcacaoAgendaSegundaChamada" p0 WHERE p0.id=NEW."propostaId";
 SELECT * INTO r FROM "ReservaSegundaChamada" WHERE id=r.id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Remarcação aprovada exige reserva existente'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO p FROM "PropostaRemarcacaoAgendaSegundaChamada" WHERE id=NEW."propostaId" FOR KEY SHARE;
 SELECT * INTO a FROM "AgendaSegundaChamada" WHERE "reservaId"=r.id FOR UPDATE;
 SELECT * INTO e FROM "EncontroAgenda" WHERE id=a."encontroId" FOR UPDATE;
 agora:=clock_timestamp() AT TIME ZONE 'UTC';
 IF r.status<>'RESERVADA' OR p.snapshot IS DISTINCT FROM estado_remarcacao_agenda_segunda_chamada(r.id) OR e.status<>'PREVISTO' OR e.finalidade<>'SEGUNDA_CHAMADA' OR p.inicio<=agora OR EXISTS(SELECT 1 FROM "OcorrenciaSegundaChamada" WHERE "reservaId"=r.id) OR EXISTS(SELECT 1 FROM "RealizacaoSegundaChamada" WHERE "reservaId"=r.id) THEN RAISE EXCEPTION 'A agenda mudou antes da remarcação aprovada'; END IF;
 novo:='remarcacao-segunda:'||NEW.id;
 INSERT INTO "EncontroAgenda" (id,"turmaId","matriculaId","professorId","preparadorId",inicio,fim,"fusoOrigem",status,motivo,"chaveIdempotencia","entradaHash",finalidade,"criadoEm") VALUES (novo,e."turmaId",e."matriculaId",e."professorId",NEW."decisorId",p.inicio,p.fim,p."fusoOrigem",'PREVISTO',p.motivo,'remarcacao-segunda:'||NEW.id,p."entradaHash",'SEGUNDA_CHAMADA',agora);
 INSERT INTO "AplicacaoRemarcacaoAgendaSegundaChamada" (id,"decisaoId","encontroOriginalId","encontroNovoId","aplicadaEm") VALUES ('aplicacao-remarcacao-segunda:'||NEW.id,NEW.id,e.id,novo,agora);
 UPDATE "DecisaoRemarcacaoAgendaSegundaChamada" SET "encontroNovoId"=novo WHERE id=NEW.id AND "encontroNovoId" IS NULL;
 UPDATE "EncontroAgenda" SET status='CANCELADO' WHERE id=e.id AND status='PREVISTO'; IF NOT FOUND THEN RAISE EXCEPTION 'Encontro anterior mudou antes da remarcação'; END IF;
 UPDATE "AgendaSegundaChamada" SET "encontroId"=novo WHERE id=a.id AND "encontroId"=e.id; IF NOT FOUND THEN RAISE EXCEPTION 'Agenda mudou antes da remarcação'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER aplicar_remarcacao_agenda_segunda_chamada AFTER INSERT ON "DecisaoRemarcacaoAgendaSegundaChamada" FOR EACH ROW EXECUTE FUNCTION aplicar_remarcacao_agenda_segunda_chamada();

CREATE FUNCTION preservar_ligacao_remarcacao_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."encontroId" IS DISTINCT FROM OLD."encontroId" AND NOT EXISTS (SELECT 1 FROM "AplicacaoRemarcacaoAgendaSegundaChamada" x JOIN "DecisaoRemarcacaoAgendaSegundaChamada" d ON d.id=x."decisaoId" AND d.aprovada WHERE x."encontroOriginalId"=OLD."encontroId" AND x."encontroNovoId"=NEW."encontroId") THEN RAISE EXCEPTION 'Agenda de segunda chamada só muda por remarcação aprovada'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER preservar_ligacao_remarcacao_agenda_segunda_chamada BEFORE UPDATE OF "encontroId" ON "AgendaSegundaChamada" FOR EACH ROW EXECUTE FUNCTION preservar_ligacao_remarcacao_agenda_segunda_chamada();

CREATE OR REPLACE FUNCTION preservar_conclusao_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.status='CANCELADO' AND EXISTS(SELECT 1 FROM "AplicacaoRemarcacaoAgendaSegundaChamada" x WHERE x."encontroOriginalId"=OLD.id) THEN RAISE EXCEPTION 'Encontro anterior remarcado não pode ser apagado'; END IF;
  IF OLD.status='MINISTRADO' AND EXISTS(SELECT 1 FROM "AgendaSegundaChamada" a WHERE a."encontroId"=OLD.id) THEN RAISE EXCEPTION 'Encontro de segunda chamada ministrado não pode ser apagado'; END IF;
  IF OLD.status='NAO_REALIZADO' AND EXISTS(SELECT 1 FROM "AgendaSegundaChamada" a WHERE a."encontroId"=OLD.id) THEN RAISE EXCEPTION 'Encontro de segunda chamada não realizado não pode ser apagado'; END IF;
  IF OLD.status='CANCELADO' AND EXISTS(SELECT 1 FROM "AgendaSegundaChamada" a WHERE a."encontroId"=OLD.id AND cancelamento_agenda_segunda_chamada_aprovado_valido(a."reservaId",OLD.id)) THEN RAISE EXCEPTION 'Encontro de segunda chamada cancelado é imutável'; END IF;
  RETURN OLD;
 END IF;
 IF OLD.status='CANCELADO' AND EXISTS(SELECT 1 FROM "AplicacaoRemarcacaoAgendaSegundaChamada" x WHERE x."encontroOriginalId"=OLD.id) THEN RAISE EXCEPTION 'Encontro anterior remarcado é imutável'; END IF;
 IF EXISTS(SELECT 1 FROM "AgendaSegundaChamada" a WHERE a."encontroId"=OLD.id) THEN
  IF OLD.status='MINISTRADO' THEN RAISE EXCEPTION 'Encontro de segunda chamada ministrado é imutável'; END IF;
  IF OLD.status='NAO_REALIZADO' THEN RAISE EXCEPTION 'Encontro de segunda chamada não realizado é imutável'; END IF;
  IF OLD.status='CANCELADO' AND EXISTS(SELECT 1 FROM "AgendaSegundaChamada" a WHERE a."encontroId"=OLD.id AND cancelamento_agenda_segunda_chamada_aprovado_valido(a."reservaId",OLD.id)) THEN RAISE EXCEPTION 'Encontro de segunda chamada cancelado é imutável'; END IF;
  IF NEW.status='MINISTRADO' AND OLD.status='PREVISTO' AND (to_jsonb(OLD)-'status')=(to_jsonb(NEW)-'status') AND EXISTS(SELECT 1 FROM "RealizacaoSegundaChamada" sc JOIN "ReservaSegundaChamada" r ON r.id=sc."reservaId" JOIN "AgendaSegundaChamada" a ON a."reservaId"=r.id WHERE a."encontroId"=OLD.id AND r.status='CONSUMIDA_REALIZACAO' AND sc."professorId" IS NOT DISTINCT FROM OLD."professorId" AND sc."realizadaEm">=OLD.inicio AND sc."realizadaEm"<OLD.fim) THEN RETURN NEW; END IF;
  IF NEW.status='MINISTRADO' THEN RAISE EXCEPTION 'Conclusão da segunda chamada exige realização correspondente'; END IF;
  IF NEW.status='CANCELADO' THEN
   IF OLD.status='PREVISTO' AND (to_jsonb(OLD)-'status')=(to_jsonb(NEW)-'status') AND (
    EXISTS(SELECT 1 FROM "AgendaSegundaChamada" a WHERE a."encontroId"=OLD.id AND cancelamento_agenda_segunda_chamada_aprovado_valido(a."reservaId",OLD.id))
    OR EXISTS(SELECT 1 FROM "AplicacaoRemarcacaoAgendaSegundaChamada" x WHERE x."encontroOriginalId"=OLD.id)
   ) THEN RETURN NEW; END IF;
   RAISE EXCEPTION 'Cancelamento da segunda chamada exige decisão aprovada e ocorrência correspondente';
  END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION conferir_aplicacao_remarcacao_agenda_segunda_chamada_final() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM "AplicacaoRemarcacaoAgendaSegundaChamada" x JOIN "DecisaoRemarcacaoAgendaSegundaChamada" d ON d.id=x."decisaoId" AND d.aprovada AND d."encontroNovoId"=x."encontroNovoId" JOIN "PropostaRemarcacaoAgendaSegundaChamada" p ON p.id=d."propostaId" JOIN "ReservaSegundaChamada" r ON r.id=p."reservaId" AND r.status='RESERVADA' JOIN "AgendaSegundaChamada" a ON a."reservaId"=r.id AND a."encontroId"=x."encontroNovoId" JOIN "EncontroAgenda" antigo ON antigo.id=x."encontroOriginalId" AND antigo.status='CANCELADO' JOIN "EncontroAgenda" novo ON novo.id=x."encontroNovoId" AND novo.status='PREVISTO' AND novo.finalidade='SEGUNDA_CHAMADA' WHERE x.id=NEW.id) THEN RAISE EXCEPTION 'Aplicação de remarcação incompleta'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER conferir_aplicacao_remarcacao_agenda_segunda_chamada_final AFTER INSERT ON "AplicacaoRemarcacaoAgendaSegundaChamada" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION conferir_aplicacao_remarcacao_agenda_segunda_chamada_final();
