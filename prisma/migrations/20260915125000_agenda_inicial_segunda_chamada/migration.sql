CREATE TABLE "PropostaAgendaSegundaChamada" (
 id TEXT PRIMARY KEY,"propostaSegundaChamadaId" TEXT NOT NULL,"autorId" TEXT NOT NULL,"professorId" TEXT NOT NULL,versao INTEGER NOT NULL,
 inicio TIMESTAMP(3) NOT NULL,fim TIMESTAMP(3) NOT NULL,"fusoOrigem" TEXT NOT NULL,motivo TEXT NOT NULL,evidencia TEXT NOT NULL,"motivoExcecaoNaoLetiva" TEXT,
 "calendarioId" TEXT NOT NULL,"calendarioVersao" INTEGER NOT NULL,"fusoInstitucional" TEXT NOT NULL,"periodosNaoLetivos" JSONB NOT NULL,snapshot JSONB NOT NULL,"entradaHash" TEXT NOT NULL,"chaveIdempotencia" TEXT NOT NULL,"criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),
 CHECK(versao>0 AND isfinite(inicio) AND isfinite(fim) AND fim>inicio),CHECK(length(btrim("fusoOrigem"))>0 AND length(btrim(motivo)) BETWEEN 5 AND 2000 AND length(btrim(evidencia)) BETWEEN 5 AND 4000),CHECK("motivoExcecaoNaoLetiva" IS NULL OR length(btrim("motivoExcecaoNaoLetiva")) BETWEEN 5 AND 2000),CHECK("calendarioVersao">0 AND length(btrim("fusoInstitucional"))>0 AND jsonb_typeof("periodosNaoLetivos")='array'),CHECK("entradaHash"~'^[a-f0-9]{64}$'),CHECK(length("chaveIdempotencia") BETWEEN 8 AND 100),
 UNIQUE("propostaSegundaChamadaId",versao),UNIQUE("autorId","chaveIdempotencia")
);
CREATE TABLE "DecisaoAgendaSegundaChamada" (
 id TEXT PRIMARY KEY,"propostaId" TEXT NOT NULL UNIQUE,"decisorId" TEXT NOT NULL,aprovada BOOLEAN NOT NULL,"autorizarDiaNaoLetivo" BOOLEAN NOT NULL DEFAULT false,motivo TEXT NOT NULL,"encontroId" TEXT UNIQUE,"criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),
 CHECK(length(btrim(motivo)) BETWEEN 5 AND 2000),CHECK(aprovada OR NOT "autorizarDiaNaoLetivo")
);
CREATE TABLE "AplicacaoAgendaSegundaChamada" (
 id TEXT PRIMARY KEY,"decisaoId" TEXT NOT NULL UNIQUE,"encontroId" TEXT NOT NULL UNIQUE,"reservaId" TEXT NOT NULL UNIQUE,"agendaId" TEXT NOT NULL UNIQUE,"aplicadaEm" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC')
);
CREATE INDEX "PropostaAgendaSegundaChamada_fonte_criada_idx" ON "PropostaAgendaSegundaChamada"("propostaSegundaChamadaId","criadaEm");
ALTER TABLE "EncontroAgenda" ADD COLUMN "propostaAgendaSegundaChamadaId" TEXT UNIQUE;
ALTER TABLE "PropostaAgendaSegundaChamada" ADD FOREIGN KEY("propostaSegundaChamadaId") REFERENCES "PropostaSegundaChamada"(id) ON DELETE RESTRICT;
ALTER TABLE "PropostaAgendaSegundaChamada" ADD FOREIGN KEY("autorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT;
ALTER TABLE "PropostaAgendaSegundaChamada" ADD FOREIGN KEY("professorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT;
ALTER TABLE "DecisaoAgendaSegundaChamada" ADD FOREIGN KEY("propostaId") REFERENCES "PropostaAgendaSegundaChamada"(id) ON DELETE RESTRICT;
ALTER TABLE "DecisaoAgendaSegundaChamada" ADD FOREIGN KEY("decisorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT;
ALTER TABLE "DecisaoAgendaSegundaChamada" ADD FOREIGN KEY("encontroId") REFERENCES "EncontroAgenda"(id) ON DELETE RESTRICT;
ALTER TABLE "AplicacaoAgendaSegundaChamada" ADD FOREIGN KEY("decisaoId") REFERENCES "DecisaoAgendaSegundaChamada"(id) ON DELETE RESTRICT;
ALTER TABLE "AplicacaoAgendaSegundaChamada" ADD FOREIGN KEY("encontroId") REFERENCES "EncontroAgenda"(id) ON DELETE RESTRICT;
ALTER TABLE "AplicacaoAgendaSegundaChamada" ADD FOREIGN KEY("reservaId") REFERENCES "ReservaSegundaChamada"(id) ON DELETE RESTRICT;
ALTER TABLE "AplicacaoAgendaSegundaChamada" ADD FOREIGN KEY("agendaId") REFERENCES "AgendaSegundaChamada"(id) ON DELETE RESTRICT;
ALTER TABLE "EncontroAgenda" ADD FOREIGN KEY("propostaAgendaSegundaChamadaId") REFERENCES "PropostaAgendaSegundaChamada"(id) ON DELETE RESTRICT;

CREATE FUNCTION conferir_proposta_agenda_inicial_segunda() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaSegundaChamada"%ROWTYPE; cal JSONB; agora TIMESTAMP;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Proposta de agenda inicial é imutável'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT p0.* INTO p FROM "PropostaSegundaChamada" p0 WHERE id=NEW."propostaSegundaChamadaId" FOR KEY SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Fonte da agenda não encontrada'; END IF;
 PERFORM id FROM "Usuario" WHERE id=NEW."autorId" AND ativo AND papeis && ARRAY['SECRETARIA_ACADEMICA','GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Proposta exige equipe ativa'; END IF;
 cal:=estado_calendario_remarcacao_segunda_chamada(NEW.inicio,NEW.fim);
 IF (NEW."calendarioId",NEW."calendarioVersao",NEW."fusoInstitucional",NEW."periodosNaoLetivos") IS DISTINCT FROM (cal->>'calendarioId',(cal->>'calendarioVersao')::integer,cal->>'fusoInstitucional',cal->'periodosNaoLetivos') THEN RAISE EXCEPTION 'Calendário da proposta mudou'; END IF;
 IF (jsonb_array_length(cal->'periodosNaoLetivos')>0) IS DISTINCT FROM (NEW."motivoExcecaoNaoLetiva" IS NOT NULL) THEN RAISE EXCEPTION 'Exceção não letiva exige justificativa exata'; END IF;
 IF NEW.versao<>COALESCE((SELECT max(versao) FROM "PropostaAgendaSegundaChamada" WHERE "propostaSegundaChamadaId"=p.id),0)+1 THEN RAISE EXCEPTION 'Versão da agenda desatualizada'; END IF;
 agora:=clock_timestamp() AT TIME ZONE 'UTC'; IF NEW.inicio<=agora OR NOT professor_segunda_chamada_cobre_intervalo(p.id,NEW."professorId",NEW.inicio,NEW.fim) THEN RAISE EXCEPTION 'Intervalo ou escopo docente inválido'; END IF;
 NEW."criadaEm":=agora; RETURN NEW;
END $$;
CREATE TRIGGER conferir_proposta_agenda_inicial_segunda BEFORE INSERT OR UPDATE OR DELETE ON "PropostaAgendaSegundaChamada" FOR EACH ROW EXECUTE FUNCTION conferir_proposta_agenda_inicial_segunda();

CREATE FUNCTION conferir_decisao_agenda_inicial_segunda() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaAgendaSegundaChamada"%ROWTYPE; cal JSONB;
BEGIN
 IF TG_OP<>'INSERT' THEN
   IF TG_OP='UPDATE' AND pg_trigger_depth()>1 AND OLD."encontroId" IS NULL AND NEW."encontroId" IS NOT NULL AND (to_jsonb(OLD)-'encontroId') IS NOT DISTINCT FROM (to_jsonb(NEW)-'encontroId') THEN RETURN NEW; END IF;
   RAISE EXCEPTION 'Decisão de agenda inicial é imutável';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO p FROM "PropostaAgendaSegundaChamada" WHERE id=NEW."propostaId" FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de agenda não encontrada'; END IF;
 PERFORM id FROM "Usuario" WHERE id=NEW."decisorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE; IF NOT FOUND OR NEW."decisorId"=p."autorId" THEN RAISE EXCEPTION 'Decisão exige outra gestão ativa'; END IF;
 IF NEW."encontroId" IS NOT NULL THEN RAISE EXCEPTION 'Decisão não recebe encontro diretamente'; END IF;
 IF NEW.aprovada THEN cal:=estado_calendario_remarcacao_segunda_chamada(p.inicio,p.fim); IF (p."calendarioId",p."calendarioVersao",p."fusoInstitucional",p."periodosNaoLetivos") IS DISTINCT FROM (cal->>'calendarioId',(cal->>'calendarioVersao')::integer,cal->>'fusoInstitucional',cal->'periodosNaoLetivos') OR NEW."autorizarDiaNaoLetivo" IS DISTINCT FROM (jsonb_array_length(cal->'periodosNaoLetivos')>0) THEN RAISE EXCEPTION 'Calendário ou autorização da exceção mudou'; END IF; END IF;
 NEW."criadaEm":=clock_timestamp() AT TIME ZONE 'UTC'; RETURN NEW;
END $$;
CREATE TRIGGER conferir_decisao_agenda_inicial_segunda BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoAgendaSegundaChamada" FOR EACH ROW EXECUTE FUNCTION conferir_decisao_agenda_inicial_segunda();

CREATE FUNCTION aplicar_agenda_inicial_segunda() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaAgendaSegundaChamada"%ROWTYPE; f "PropostaSegundaChamada"%ROWTYPE; disp "DisponibilizacaoSegundaChamada"%ROWTYPE; prazo TIMESTAMP; encontro TEXT; reserva TEXT; agenda TEXT; agora TIMESTAMP; antecedencia INTEGER;
BEGIN
 IF NOT NEW.aprovada THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO p FROM "PropostaAgendaSegundaChamada" WHERE id=NEW."propostaId" FOR KEY SHARE;
 SELECT * INTO f FROM "PropostaSegundaChamada" WHERE id=p."propostaSegundaChamadaId" FOR UPDATE;
 SELECT * INTO disp FROM "DisponibilizacaoSegundaChamada" WHERE "propostaId"=f.id FOR KEY SHARE;
 SELECT COALESCE((SELECT pr."novoPrazo" FROM "PropostaProrrogacaoSegundaChamada" pr JOIN "DecisaoProrrogacaoSegundaChamada" d ON d."propostaId"=pr.id AND d.aprovada WHERE pr."disponibilizacaoId"=disp.id ORDER BY pr.versao DESC LIMIT 1),disp."prazoAte") INTO prazo;
 agora:=clock_timestamp() AT TIME ZONE 'UTC';
 IF NOT EXISTS(SELECT 1 FROM "DecisaoSegundaChamada" WHERE "propostaId"=f.id AND aprovada) OR disp.id IS NULL OR p.inicio<=agora OR p.fim>prazo OR NOT professor_segunda_chamada_cobre_intervalo(f.id,p."professorId",p.inicio,p.fim) THEN RAISE EXCEPTION 'Fontes, prazo ou docente mudaram antes da aplicação'; END IF;
 IF NOT EXISTS(
   SELECT 1 FROM "AlocacaoTurma" a JOIN "Turma" t ON t.id=a."turmaId"
   WHERE a.id=f."alocacaoId" AND a."matriculaId"=f."matriculaId" AND a."turmaId"=f."turmaId" AND t."regraAvaliacaoId"=f."regraId"
 ) THEN RAISE EXCEPTION 'Vínculo, turma ou regra da segunda chamada mudou'; END IF;
 IF EXISTS(
   SELECT 1 FROM "RegistroAvaliacaoMatricula" r
   JOIN "VersaoLancamentoAvaliacao" l ON l."registroId"=r.id
   JOIN "DecisaoLancamentoAvaliacao" d ON d."lancamentoId"=l.id AND d.aprovada
   WHERE r."matriculaId"=f."matriculaId" AND r."alocacaoId"=f."alocacaoId" AND r."turmaId"=f."turmaId" AND r."regraId"=f."regraId" AND r."codigoAvaliacao"=f."codigoAvaliacao"
 ) THEN RAISE EXCEPTION 'Avaliação já possui nota oficial'; END IF;
 IF (situacao_matricula_no_instante(f."matriculaId",p.inicio) IN ('PAUSADA','ENCERRADA')
       AND NOT autorizacao_especial_segunda_chamada_valida(f."alocacaoId",f."codigoAvaliacao",p.inicio))
    OR (situacao_matricula_no_instante(f."matriculaId",p.fim-interval '1 millisecond') IN ('PAUSADA','ENCERRADA')
       AND NOT autorizacao_especial_segunda_chamada_valida(f."alocacaoId",f."codigoAvaliacao",p.fim-interval '1 millisecond')) THEN
   RAISE EXCEPTION 'Intervalo em matrícula pausada ou encerrada exige autorização especial vigente';
 END IF; IF jsonb_typeof(p.snapshot) <> 'object'
   OR p.snapshot->>'propostaSegundaChamadaId' IS DISTINCT FROM f.id
   OR p.snapshot->>'matriculaId' IS DISTINCT FROM f."matriculaId"
   OR p.snapshot->>'alocacaoId' IS DISTINCT FROM f."alocacaoId"
   OR p.snapshot->>'turmaId' IS DISTINCT FROM f."turmaId"
   OR p.snapshot->>'regraId' IS DISTINCT FROM f."regraId"
   OR p.snapshot->>'codigoAvaliacao' IS DISTINCT FROM f."codigoAvaliacao"
   OR p.snapshot->>'professorId' IS DISTINCT FROM p."professorId"
   OR p.snapshot->>'prazoAte' IS DISTINCT FROM to_char(prazo,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
   OR p.snapshot->>'inicio' IS DISTINCT FROM to_char(p.inicio,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
   OR p.snapshot->>'fim' IS DISTINCT FROM to_char(p.fim,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
   OR p.snapshot->>'fusoOrigem' IS DISTINCT FROM p."fusoOrigem"
   OR p.snapshot->'calendario' IS DISTINCT FROM jsonb_build_object('calendarioId',p."calendarioId",'calendarioVersao',p."calendarioVersao",'fusoInstitucional',p."fusoInstitucional",'periodosNaoLetivos',p."periodosNaoLetivos")
   OR p.snapshot->'conflitos' IS DISTINCT FROM jsonb_build_object('encontros','[]'::jsonb,'indisponibilidades',0,'reservas',0) THEN
  RAISE EXCEPTION 'Snapshot da agenda inicial não confere com a fonte atual';
END IF;
IF EXISTS(SELECT 1 FROM "ReservaSegundaChamada" WHERE "propostaId"=f.id AND status='RESERVADA') THEN RAISE EXCEPTION 'A proposta já possui reserva vigente'; END IF;
 IF EXISTS (
   SELECT 1 FROM "EncontroAgenda" e
   LEFT JOIN "Matricula" m ON m.id=e."matriculaId"
   WHERE e.status IN ('PREVISTO','MINISTRADO') AND e.inicio<p.fim AND e.fim>p.inicio
     AND (
       e."professorId"=p."professorId"
       OR m."alunoId"=(SELECT "alunoId" FROM "Matricula" WHERE id=f."matriculaId")
       OR (e."matriculaId" IS NULL AND EXISTS (
         SELECT 1 FROM "AlocacaoTurma" a
         WHERE a."alunoId"=(SELECT "alunoId" FROM "Matricula" WHERE id=f."matriculaId")
           AND a."turmaId"=e."turmaId" AND a."criadoEm"<p.fim AND a."criadoEm"<e.fim
           AND (a."encerradaEm" IS NULL OR (a."encerradaEm">p.inicio AND a."encerradaEm">e.inicio))
       ))
     )
 ) THEN RAISE EXCEPTION 'Conflito de agenda antes da aplicação'; END IF;
 IF EXISTS(SELECT 1 FROM "IndisponibilidadeDocente" i JOIN "DecisaoIndisponibilidadeDocente" d ON d."indisponibilidadeId"=i.id AND d.aprovada WHERE i."professorId"=p."professorId" AND i.inicio<p.fim AND i.fim>p.inicio) OR EXISTS(SELECT 1 FROM "HorarioReservaParticular" h JOIN "ReservaAgendaParticular" rh ON rh.id=h."reservaId" JOIN "Matricula" rm ON rm.id=rh."matriculaId" WHERE rh.status IN ('ATIVA','MANTIDA_PENDENCIA') AND h.inicio<p.fim AND h.fim>p.inicio AND (h."professorId"=p."professorId" OR rm."alunoId"=(SELECT "alunoId" FROM "Matricula" WHERE id=f."matriculaId"))) THEN RAISE EXCEPTION 'Indisponibilidade ou reserva comercial conflitante'; END IF;
 encontro:='agenda-inicial-segunda:'||NEW.id; reserva:='reserva-agenda-inicial-segunda:'||NEW.id; agenda:='agenda-inicial-segunda:'||NEW.id;
 SELECT (r.conteudo->'segundaChamada'->>'antecedenciaCancelamentoMinutos')::integer INTO antecedencia FROM "VersaoRegraAvaliacao" r WHERE r.id=f."regraId";
 INSERT INTO "EncontroAgenda"(id,"turmaId","matriculaId","professorId","preparadorId",inicio,fim,"fusoOrigem",finalidade,status,motivo,"chaveIdempotencia","entradaHash","propostaAgendaSegundaChamadaId") VALUES(encontro,f."turmaId",f."matriculaId",p."professorId",p."autorId",p.inicio,p.fim,p."fusoOrigem",'SEGUNDA_CHAMADA','PREVISTO',p.motivo,'agenda-inicial:'||NEW.id,p."entradaHash",p.id);
 INSERT INTO "ReservaSegundaChamada"(id,"propostaId","matriculaId","regraId","codigoAvaliacao","reservadaPorId","reservadaEm",status,"regraCancelamentoMinutos") VALUES(reserva,f.id,f."matriculaId",f."regraId",f."codigoAvaliacao",NEW."decisorId",agora,'RESERVADA',antecedencia);
 INSERT INTO "AgendaSegundaChamada"(id,"reservaId","encontroId","agendadaPorId") VALUES(agenda,reserva,encontro,NEW."decisorId");
 UPDATE "DecisaoAgendaSegundaChamada" SET "encontroId"=encontro WHERE id=NEW.id;
 INSERT INTO "AplicacaoAgendaSegundaChamada"(id,"decisaoId","encontroId","reservaId","agendaId","aplicadaEm") VALUES('aplicacao-agenda-inicial-segunda:'||NEW.id,NEW.id,encontro,reserva,agenda,agora);
 RETURN NEW;
END $$;
CREATE TRIGGER aplicar_agenda_inicial_segunda AFTER INSERT ON "DecisaoAgendaSegundaChamada" FOR EACH ROW EXECUTE FUNCTION aplicar_agenda_inicial_segunda();

-- Só o aplicador encadeado pela decisão aprovada pode materializar a aplicação.
CREATE FUNCTION conferir_aplicacao_agenda_inicial_segunda() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d "DecisaoAgendaSegundaChamada"%ROWTYPE; p "PropostaAgendaSegundaChamada"%ROWTYPE;
BEGIN
 IF TG_OP <> 'INSERT' OR pg_trigger_depth() <= 1 THEN
   RAISE EXCEPTION 'Aplicação de agenda inicial é exclusiva da decisão aprovada';
 END IF;
 SELECT * INTO d FROM "DecisaoAgendaSegundaChamada" WHERE id=NEW."decisaoId" FOR KEY SHARE;
 IF NOT FOUND OR NOT d.aprovada OR d."encontroId" IS DISTINCT FROM NEW."encontroId" THEN RAISE EXCEPTION 'Aplicação sem decisão aprovada correspondente'; END IF;
 SELECT * INTO p FROM "PropostaAgendaSegundaChamada" WHERE id=d."propostaId" FOR KEY SHARE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM "EncontroAgenda" e WHERE e.id=NEW."encontroId" AND e.finalidade='SEGUNDA_CHAMADA' AND e.status='PREVISTO' AND e."propostaAgendaSegundaChamadaId"=p.id)
    OR NOT EXISTS(SELECT 1 FROM "ReservaSegundaChamada" r WHERE r.id=NEW."reservaId" AND r."propostaId"=p."propostaSegundaChamadaId" AND r.status='RESERVADA')
    OR NOT EXISTS(SELECT 1 FROM "AgendaSegundaChamada" a WHERE a.id=NEW."agendaId" AND a."reservaId"=NEW."reservaId" AND a."encontroId"=NEW."encontroId") THEN RAISE EXCEPTION 'Aplicação de agenda inicial sem cadeia íntegra'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_aplicacao_agenda_inicial_segunda BEFORE INSERT OR UPDATE OR DELETE ON "AplicacaoAgendaSegundaChamada" FOR EACH ROW EXECUTE FUNCTION conferir_aplicacao_agenda_inicial_segunda();

-- Encontros com fonte da proposta só nascem pelo aplicador; o legado sem fonte segue transitório.
CREATE FUNCTION conferir_origem_agenda_inicial_segunda() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD."propostaAgendaSegundaChamadaId" IS DISTINCT FROM NEW."propostaAgendaSegundaChamadaId" THEN
   RAISE EXCEPTION 'Fonte da agenda inicial de segunda chamada é imutável';
 END IF;
 IF NEW."propostaAgendaSegundaChamadaId" IS NOT NULL AND (TG_OP <> 'INSERT' OR pg_trigger_depth() <= 1) THEN
   RAISE EXCEPTION 'Encontro inicial de segunda chamada exige decisão aplicada';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_origem_agenda_inicial_segunda BEFORE INSERT OR UPDATE OF "propostaAgendaSegundaChamadaId" ON "EncontroAgenda" FOR EACH ROW EXECUTE FUNCTION conferir_origem_agenda_inicial_segunda();