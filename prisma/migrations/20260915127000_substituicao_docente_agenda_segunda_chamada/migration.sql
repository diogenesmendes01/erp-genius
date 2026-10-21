CREATE TABLE "PropostaSubstituicaoAgendaSegundaChamada" (
 id TEXT PRIMARY KEY,"reservaId" TEXT NOT NULL,"encontroId" TEXT NOT NULL,"autorId" TEXT NOT NULL,"substitutoId" TEXT NOT NULL,versao INTEGER NOT NULL,motivo TEXT NOT NULL,evidencia TEXT NOT NULL,snapshot JSONB NOT NULL,"entradaHash" TEXT NOT NULL,"chaveIdempotencia" TEXT NOT NULL,"criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),
 CHECK(versao>0),CHECK(length(btrim(motivo)) BETWEEN 5 AND 2000 AND length(btrim(evidencia)) BETWEEN 5 AND 4000),CHECK("entradaHash"~'^[a-f0-9]{64}$'),CHECK(length("chaveIdempotencia") BETWEEN 8 AND 100),UNIQUE("reservaId",versao),UNIQUE("autorId","chaveIdempotencia")
);
CREATE TABLE "DecisaoSubstituicaoAgendaSegundaChamada" (
 id TEXT PRIMARY KEY,"propostaId" TEXT NOT NULL UNIQUE,"decisorId" TEXT NOT NULL,aprovada BOOLEAN NOT NULL,motivo TEXT NOT NULL,"criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),CHECK(length(btrim(motivo)) BETWEEN 5 AND 2000)
);
CREATE TABLE "AplicacaoSubstituicaoAgendaSegundaChamada" (
 id TEXT PRIMARY KEY,"decisaoId" TEXT NOT NULL UNIQUE,"encontroId" TEXT NOT NULL,"professorAnteriorId" TEXT NOT NULL,"professorNovoId" TEXT NOT NULL,"designacaoId" TEXT NOT NULL UNIQUE,"aplicadaEm" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),CHECK("professorAnteriorId"<>"professorNovoId")
);
CREATE INDEX "PropostaSubstituicaoAgendaSegundaChamada_encontro_criada_idx" ON "PropostaSubstituicaoAgendaSegundaChamada"("encontroId","criadaEm");
ALTER TABLE "PropostaSubstituicaoAgendaSegundaChamada" ADD FOREIGN KEY("reservaId") REFERENCES "ReservaSegundaChamada"(id) ON DELETE RESTRICT;
ALTER TABLE "PropostaSubstituicaoAgendaSegundaChamada" ADD FOREIGN KEY("encontroId") REFERENCES "EncontroAgenda"(id) ON DELETE RESTRICT;
ALTER TABLE "PropostaSubstituicaoAgendaSegundaChamada" ADD FOREIGN KEY("autorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT;
ALTER TABLE "PropostaSubstituicaoAgendaSegundaChamada" ADD FOREIGN KEY("substitutoId") REFERENCES "Usuario"(id) ON DELETE RESTRICT;
ALTER TABLE "DecisaoSubstituicaoAgendaSegundaChamada" ADD FOREIGN KEY("propostaId") REFERENCES "PropostaSubstituicaoAgendaSegundaChamada"(id) ON DELETE RESTRICT;
ALTER TABLE "DecisaoSubstituicaoAgendaSegundaChamada" ADD FOREIGN KEY("decisorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT;
ALTER TABLE "AplicacaoSubstituicaoAgendaSegundaChamada" ADD FOREIGN KEY("decisaoId") REFERENCES "DecisaoSubstituicaoAgendaSegundaChamada"(id) ON DELETE RESTRICT;
ALTER TABLE "AplicacaoSubstituicaoAgendaSegundaChamada" ADD FOREIGN KEY("encontroId") REFERENCES "EncontroAgenda"(id) ON DELETE RESTRICT;
ALTER TABLE "AplicacaoSubstituicaoAgendaSegundaChamada" ADD FOREIGN KEY("professorAnteriorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT;
ALTER TABLE "AplicacaoSubstituicaoAgendaSegundaChamada" ADD FOREIGN KEY("professorNovoId") REFERENCES "Usuario"(id) ON DELETE RESTRICT;
ALTER TABLE "AplicacaoSubstituicaoAgendaSegundaChamada" ADD FOREIGN KEY("designacaoId") REFERENCES "DesignacaoSegundaChamada"(id) ON DELETE RESTRICT;

CREATE FUNCTION estado_substituicao_agenda_segunda_chamada(p_reserva_id TEXT,p_substituto_id TEXT) RETURNS JSONB LANGUAGE plpgsql VOLATILE AS $$
DECLARE base JSONB; e record; f record; cal_fonte JSONB; cal_atual JSONB; design JSONB;
BEGIN
 SELECT r.id,r."propostaId",r."matriculaId",r."regraId",r."codigoAvaliacao",r.status,r."reservadaEm",a.id AS agenda_id,a."encontroId",a."agendadaPorId",a."criadaEm" AS agenda_criada,e0.id AS encontro_id,e0.finalidade,e0.status AS encontro_status,e0."matriculaId" AS encontro_matricula,e0."turmaId" AS encontro_turma,e0."professorId",e0.inicio,e0.fim,e0."fusoOrigem",p."alocacaoId",p."turmaId",p."regraId" AS fonte_regra,p."codigoAvaliacao" AS fonte_codigo,d.id AS disponibilizacao_id,COALESCE((SELECT pr."novoPrazo" FROM "PropostaProrrogacaoSegundaChamada" pr JOIN "DecisaoProrrogacaoSegundaChamada" dd ON dd."propostaId"=pr.id AND dd.aprovada WHERE pr."disponibilizacaoId"=d.id ORDER BY pr.versao DESC LIMIT 1),d."prazoAte") AS prazo,m.status AS matricula_status,al.ativa AS alocacao_ativa INTO e FROM "ReservaSegundaChamada" r JOIN "PropostaSegundaChamada" p ON p.id=r."propostaId" JOIN "Matricula" m ON m.id=p."matriculaId" JOIN "AlocacaoTurma" al ON al.id=p."alocacaoId" LEFT JOIN "DisponibilizacaoSegundaChamada" d ON d."propostaId"=p.id LEFT JOIN "AgendaSegundaChamada" a ON a."reservaId"=r.id LEFT JOIN "EncontroAgenda" e0 ON e0.id=a."encontroId" WHERE r.id=p_reserva_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT jsonb_build_object('calendarioId',COALESCE(i."calendarioId",rm."calendarioId"),'calendarioVersao',COALESCE(i."calendarioVersao",rm."calendarioVersao"),'fusoInstitucional',COALESCE(i."fusoInstitucional",rm."fusoInstitucional"),'periodosNaoLetivos',COALESCE(i."periodosNaoLetivos",rm."periodosNaoLetivos")) INTO cal_fonte FROM "EncontroAgenda" ee LEFT JOIN "PropostaAgendaSegundaChamada" i ON i.id=ee."propostaAgendaSegundaChamadaId" LEFT JOIN "AplicacaoRemarcacaoAgendaSegundaChamada" ar ON ar."encontroNovoId"=ee.id LEFT JOIN "DecisaoRemarcacaoAgendaSegundaChamada" rd ON rd.id=ar."decisaoId" LEFT JOIN "PropostaRemarcacaoAgendaSegundaChamada" rm ON rm.id=rd."propostaId" WHERE ee.id=e.encontro_id;
 IF e.encontro_id IS NOT NULL THEN cal_atual:=estado_calendario_remarcacao_segunda_chamada(e.inicio,e.fim); SELECT jsonb_build_object('id',x.id,'versao',x.versao,'professorId',x."professorId",'inicio',x.inicio,'fim',x.fim,'criadaEm',x."criadaEm") INTO design FROM (SELECT * FROM "DesignacaoSegundaChamada" WHERE "propostaId"=e."propostaId" AND "criadaEm"<=LEAST(e.inicio,clock_timestamp() AT TIME ZONE 'UTC') ORDER BY versao DESC LIMIT 1) x; END IF;
 RETURN jsonb_build_object('reserva',jsonb_build_object('id',e.id,'propostaId',e."propostaId",'matriculaId',e."matriculaId",'regraId',e."regraId",'codigoAvaliacao',e."codigoAvaliacao",'status',e.status,'reservadaEm',e."reservadaEm"),'agenda',CASE WHEN e.agenda_id IS NULL THEN NULL ELSE jsonb_build_object('id',e.agenda_id,'encontroId',e."encontroId",'agendadaPorId',e."agendadaPorId",'criadaEm',e.agenda_criada) END,'encontro',CASE WHEN e.encontro_id IS NULL THEN NULL ELSE jsonb_build_object('id',e.encontro_id,'finalidade',e.finalidade,'status',e.encontro_status,'matriculaId',e.encontro_matricula,'turmaId',e.encontro_turma,'professorId',e."professorId",'inicio',e.inicio,'fim',e.fim,'fusoOrigem',e."fusoOrigem") END,'fatos',jsonb_build_object('ocorrencia',(SELECT jsonb_build_object('id',o.id,'status',o.status,'ocorridaEm',o."ocorridaEm") FROM "OcorrenciaSegundaChamada" o WHERE o."reservaId"=e.id),'realizacao',(SELECT jsonb_build_object('id',x.id,'professorId',x."professorId",'realizadaEm',x."realizadaEm") FROM "RealizacaoSegundaChamada" x WHERE x."reservaId"=e.id)),'fonte',jsonb_build_object('propostaSegundaChamadaId',e."propostaId",'alocacaoId',e."alocacaoId",'turmaId',e."turmaId",'regraId',e.fonte_regra,'codigoAvaliacao',e.fonte_codigo,'disponibilizacaoId',e.disponibilizacao_id,'prazoAte',e.prazo,'matriculaStatus',e.matricula_status,'situacaoMatricula',situacao_matricula_no_instante(e."matriculaId",clock_timestamp() AT TIME ZONE 'UTC'),'alocacaoAtiva',e.alocacao_ativa),'designacaoAtual',design,'substitutoId',p_substituto_id,'calendarioFonte',cal_fonte,'calendarioAtual',cal_atual);
END $$;

CREATE OR REPLACE FUNCTION conferir_origem_encontro_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE autorizado BOOLEAN := false;
BEGIN
 IF TG_OP='DELETE' THEN
   IF OLD.finalidade='SEGUNDA_CHAMADA' THEN
     RAISE EXCEPTION 'Encontro de segunda chamada não pode ser apagado';
   END IF;
   RETURN OLD;
 END IF;

 IF TG_OP='UPDATE' THEN
   IF OLD.finalidade='SEGUNDA_CHAMADA' OR NEW.finalidade='SEGUNDA_CHAMADA' THEN
     IF OLD.finalidade IS DISTINCT FROM NEW.finalidade THEN
       RAISE EXCEPTION 'Finalidade do encontro de segunda chamada é imutável';
     END IF;
     IF (to_jsonb(OLD)-'status') IS DISTINCT FROM (to_jsonb(NEW)-'status') THEN
       IF pg_trigger_depth()>1
          AND (to_jsonb(OLD)-'professorId') IS NOT DISTINCT FROM (to_jsonb(NEW)-'professorId')
          AND EXISTS(
            SELECT 1 FROM "AplicacaoSubstituicaoAgendaSegundaChamada" x
            JOIN "DecisaoSubstituicaoAgendaSegundaChamada" d ON d.id=x."decisaoId" AND d.aprovada
            WHERE x."encontroId"=OLD.id AND x."professorAnteriorId" IS NOT DISTINCT FROM OLD."professorId"
              AND x."professorNovoId" IS NOT DISTINCT FROM NEW."professorId"
          ) THEN RETURN NEW; END IF;
       RAISE EXCEPTION 'Origem e dados do encontro de segunda chamada são imutáveis';
     END IF;
     IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
     IF pg_trigger_depth()<=1 OR OLD.status<>'PREVISTO' THEN
       RAISE EXCEPTION 'Transição de segunda chamada exige fato terminal aplicado';
     END IF;
     IF NEW.status='MINISTRADO' AND EXISTS(
       SELECT 1 FROM "AgendaSegundaChamada" a JOIN "ReservaSegundaChamada" r ON r.id=a."reservaId"
       JOIN "RealizacaoSegundaChamada" x ON x."reservaId"=r.id
       WHERE a."encontroId"=OLD.id AND r.status='CONSUMIDA_REALIZACAO'
         AND x."professorId" IS NOT DISTINCT FROM OLD."professorId" AND x."realizadaEm">=OLD.inicio AND x."realizadaEm"<OLD.fim
     ) THEN RETURN NEW; END IF;
     IF NEW.status='NAO_REALIZADO' AND EXISTS(
       SELECT 1 FROM "AgendaSegundaChamada" a WHERE a."encontroId"=OLD.id
         AND falta_agenda_segunda_chamada_valida(a."reservaId",OLD.id)
     ) THEN RETURN NEW; END IF;
     IF NEW.status='IMPEDIDO_ESCOLA' AND EXISTS(
       SELECT 1 FROM "AgendaSegundaChamada" a WHERE a."encontroId"=OLD.id
         AND impedimento_escola_agenda_segunda_chamada_valido(a."reservaId",OLD.id)
     ) THEN RETURN NEW; END IF;
     IF NEW.status='CANCELADO' AND (
       EXISTS(SELECT 1 FROM "AgendaSegundaChamada" a WHERE a."encontroId"=OLD.id AND cancelamento_agenda_segunda_chamada_aprovado_valido(a."reservaId",OLD.id))
       OR EXISTS(SELECT 1 FROM "AplicacaoRemarcacaoAgendaSegundaChamada" x WHERE x."encontroOriginalId"=OLD.id)
     ) THEN RETURN NEW; END IF;
     RAISE EXCEPTION 'Transição de segunda chamada sem fato terminal correspondente';
   END IF;
   RETURN NEW;
 END IF;

 IF NEW.finalidade<>'SEGUNDA_CHAMADA' THEN RETURN NEW; END IF;
 IF NEW.status<>'PREVISTO' OR pg_trigger_depth()<=1 THEN
   RAISE EXCEPTION 'Encontro de segunda chamada exige aplicação atômica aprovada';
 END IF;

 IF NEW."propostaAgendaSegundaChamadaId" IS NOT NULL THEN
   SELECT EXISTS(
     SELECT 1 FROM "PropostaAgendaSegundaChamada" p
     JOIN "DecisaoAgendaSegundaChamada" d ON d."propostaId"=p.id AND d.aprovada AND d."encontroId" IS NULL
     WHERE p.id=NEW."propostaAgendaSegundaChamadaId"
   ) INTO autorizado;
 ELSE
   SELECT EXISTS(
     SELECT 1 FROM "DecisaoRemarcacaoAgendaSegundaChamada" d
     JOIN "PropostaRemarcacaoAgendaSegundaChamada" p ON p.id=d."propostaId"
     JOIN "ReservaSegundaChamada" r ON r.id=p."reservaId" AND r.status='RESERVADA'
     JOIN "AgendaSegundaChamada" a ON a."reservaId"=r.id
     JOIN "EncontroAgenda" antigo ON antigo.id=a."encontroId" AND antigo.finalidade='SEGUNDA_CHAMADA' AND antigo.status='PREVISTO'
     WHERE d.aprovada AND d."encontroNovoId" IS NULL
       AND NEW."turmaId" IS NOT DISTINCT FROM antigo."turmaId"
       AND NEW."matriculaId" IS NOT DISTINCT FROM antigo."matriculaId"
       AND NEW."professorId" IS NOT DISTINCT FROM antigo."professorId"
       AND NEW.inicio=p.inicio AND NEW.fim=p.fim AND NEW."fusoOrigem"=p."fusoOrigem"
   ) INTO autorizado;
 END IF;
 IF NOT autorizado THEN RAISE EXCEPTION 'Encontro de segunda chamada sem cadeia de aplicação aprovada'; END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION conferir_proposta_substituicao_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE estado JSONB; agora TIMESTAMP;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Proposta de substituição de segunda chamada é imutável'; END IF;
 PERFORM 1 FROM "ReservaSegundaChamada" WHERE id=NEW."reservaId" FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Substituição exige reserva existente'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 estado:=estado_substituicao_agenda_segunda_chamada(NEW."reservaId",NEW."substitutoId"); agora:=clock_timestamp() AT TIME ZONE 'UTC';
 IF estado IS NULL OR NEW.snapshot IS DISTINCT FROM estado OR NEW."encontroId" IS DISTINCT FROM estado#>>'{encontro,id}'
    OR estado#>>'{reserva,status}'<>'RESERVADA' OR estado#>>'{encontro,finalidade}'<>'SEGUNDA_CHAMADA' OR estado#>>'{encontro,status}'<>'PREVISTO'
    OR estado#>'{fatos,ocorrencia}' IS DISTINCT FROM 'null'::jsonb OR estado#>'{fatos,realizacao}' IS DISTINCT FROM 'null'::jsonb
    OR (estado#>>'{encontro,inicio}')::timestamp<=agora OR estado#>>'{calendarioFonte,calendarioId}' IS NULL
    OR estado->'calendarioFonte' IS DISTINCT FROM estado->'calendarioAtual' THEN RAISE EXCEPTION 'Agenda, calendário ou fonte da substituição mudou'; END IF;
 PERFORM id FROM "Usuario" WHERE id=NEW."autorId" AND ativo AND papeis && ARRAY['SECRETARIA_ACADEMICA','GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Substituição exige equipe ativa'; END IF;
 PERFORM id FROM "Usuario" WHERE id=NEW."substitutoId" AND ativo AND 'PROFESSOR'=ANY(papeis) FOR SHARE; IF NOT FOUND OR NEW."substitutoId"=estado#>>'{encontro,professorId}' THEN RAISE EXCEPTION 'Substituto precisa ser professor ativo distinto'; END IF;

 IF NEW.versao<>COALESCE((SELECT max(versao) FROM "PropostaSubstituicaoAgendaSegundaChamada" WHERE "reservaId"=NEW."reservaId"),0)+1 THEN RAISE EXCEPTION 'Versão de substituição desatualizada'; END IF;
 NEW."criadaEm":=agora; RETURN NEW;
END $$;
CREATE TRIGGER conferir_proposta_substituicao_agenda_segunda_chamada BEFORE INSERT OR UPDATE OR DELETE ON "PropostaSubstituicaoAgendaSegundaChamada" FOR EACH ROW EXECUTE FUNCTION conferir_proposta_substituicao_agenda_segunda_chamada();

CREATE FUNCTION conferir_decisao_substituicao_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaSubstituicaoAgendaSegundaChamada"%ROWTYPE; estado JSONB; agora TIMESTAMP;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Decisão de substituição de segunda chamada é imutável'; END IF;
 SELECT "reservaId" INTO p."reservaId" FROM "PropostaSubstituicaoAgendaSegundaChamada" WHERE id=NEW."propostaId"; IF NOT FOUND THEN RAISE EXCEPTION 'Decisão exige proposta existente'; END IF;
 SELECT * INTO p FROM "PropostaSubstituicaoAgendaSegundaChamada" WHERE id=NEW."propostaId" FOR KEY SHARE;
 PERFORM id FROM "ReservaSegundaChamada" WHERE id=p."reservaId" FOR UPDATE; PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 PERFORM id FROM "Usuario" WHERE id=NEW."decisorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE; IF NOT FOUND OR NEW."decisorId"=p."autorId" THEN RAISE EXCEPTION 'Decisão exige gestão ativa e independente'; END IF;
 IF NEW.aprovada THEN estado:=estado_substituicao_agenda_segunda_chamada(p."reservaId",p."substitutoId"); IF p.snapshot IS DISTINCT FROM estado THEN RAISE EXCEPTION 'Substituição desatualizada exige nova proposta'; END IF; END IF;
 agora:=clock_timestamp() AT TIME ZONE 'UTC'; NEW."criadaEm":=agora; RETURN NEW;
END $$;
CREATE TRIGGER conferir_decisao_substituicao_agenda_segunda_chamada BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoSubstituicaoAgendaSegundaChamada" FOR EACH ROW EXECUTE FUNCTION conferir_decisao_substituicao_agenda_segunda_chamada();
CREATE FUNCTION conferir_aplicacao_substituicao_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaSubstituicaoAgendaSegundaChamada"%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' OR pg_trigger_depth()<=1 THEN RAISE EXCEPTION 'Aplicação de substituição é exclusiva da decisão aprovada'; END IF;
 SELECT p0.* INTO p FROM "DecisaoSubstituicaoAgendaSegundaChamada" d JOIN "PropostaSubstituicaoAgendaSegundaChamada" p0 ON p0.id=d."propostaId" WHERE d.id=NEW."decisaoId" AND d.aprovada FOR KEY SHARE;
 IF NOT FOUND OR NEW."encontroId"<>p."encontroId" OR NEW."professorNovoId"<>p."substitutoId" THEN RAISE EXCEPTION 'Aplicação sem decisão aprovada correspondente'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "DesignacaoSegundaChamada" x WHERE x.id=NEW."designacaoId" AND x."propostaId"=(p.snapshot#>>'{fonte,propostaSegundaChamadaId}') AND x."professorId"=NEW."professorNovoId") THEN RAISE EXCEPTION 'Aplicação exige designação da fonte exata'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_aplicacao_substituicao_agenda_segunda_chamada BEFORE INSERT OR UPDATE OR DELETE ON "AplicacaoSubstituicaoAgendaSegundaChamada" FOR EACH ROW EXECUTE FUNCTION conferir_aplicacao_substituicao_agenda_segunda_chamada();

CREATE FUNCTION aplicar_substituicao_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaSubstituicaoAgendaSegundaChamada"%ROWTYPE; r "ReservaSegundaChamada"%ROWTYPE; e "EncontroAgenda"%ROWTYPE; fonte "PropostaSegundaChamada"%ROWTYPE; estado JSONB; agora TIMESTAMP; prazo TIMESTAMP; designacao TEXT; situacao_inicio TEXT; situacao_fim TEXT;
BEGIN
 IF NOT NEW.aprovada THEN RETURN NEW; END IF;
 SELECT p0."reservaId" INTO r.id FROM "PropostaSubstituicaoAgendaSegundaChamada" p0 WHERE p0.id=NEW."propostaId";
 SELECT * INTO r FROM "ReservaSegundaChamada" WHERE id=r.id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Substituição exige reserva existente'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO p FROM "PropostaSubstituicaoAgendaSegundaChamada" WHERE id=NEW."propostaId" FOR KEY SHARE;
 SELECT * INTO e FROM "EncontroAgenda" WHERE id=p."encontroId" FOR UPDATE;
 SELECT * INTO fonte FROM "PropostaSegundaChamada" WHERE id=r."propostaId" FOR UPDATE;
 agora:=clock_timestamp() AT TIME ZONE 'UTC';
 PERFORM id FROM "Usuario" WHERE id=p."substitutoId" AND ativo AND 'PROFESSOR'=ANY(papeis) FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Substituto precisa permanecer professor ativo'; END IF;
 estado:=estado_substituicao_agenda_segunda_chamada(r.id,p."substitutoId");
 IF p.snapshot IS DISTINCT FROM estado OR r.status<>'RESERVADA' OR e.finalidade<>'SEGUNDA_CHAMADA' OR e.status<>'PREVISTO' OR e.inicio<=agora OR e."professorId" IS NULL THEN RAISE EXCEPTION 'Agenda mudou antes da substituição aprovada'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "AlocacaoTurma" a JOIN "Turma" t ON t.id=a."turmaId" WHERE a.id=fonte."alocacaoId" AND a."matriculaId"=fonte."matriculaId" AND a."turmaId"=fonte."turmaId" AND t."regraAvaliacaoId"=fonte."regraId") THEN RAISE EXCEPTION 'Vínculo, turma ou regra da substituição mudou'; END IF;
 SELECT situacao_matricula_no_instante(fonte."matriculaId",e.inicio),situacao_matricula_no_instante(fonte."matriculaId",e.fim-interval '1 millisecond') INTO situacao_inicio,situacao_fim;
 IF NOT COALESCE(
   ((situacao_inicio='ATIVA' AND (SELECT ativa FROM "AlocacaoTurma" WHERE id=fonte."alocacaoId") IS TRUE) OR (situacao_inicio IN ('PAUSADA','ENCERRADA') AND autorizacao_especial_segunda_chamada_valida(fonte."alocacaoId",fonte."codigoAvaliacao",e.inicio)))
   AND ((situacao_fim='ATIVA' AND (SELECT ativa FROM "AlocacaoTurma" WHERE id=fonte."alocacaoId") IS TRUE) OR (situacao_fim IN ('PAUSADA','ENCERRADA') AND autorizacao_especial_segunda_chamada_valida(fonte."alocacaoId",fonte."codigoAvaliacao",e.fim-interval '1 millisecond'))),false) THEN
   RAISE EXCEPTION 'Situação contratual da substituição não permite o encontro';
 END IF;
 SELECT COALESCE((SELECT pr."novoPrazo" FROM "PropostaProrrogacaoSegundaChamada" pr JOIN "DecisaoProrrogacaoSegundaChamada" d ON d."propostaId"=pr.id AND d.aprovada WHERE pr."disponibilizacaoId"=disp.id ORDER BY pr.versao DESC LIMIT 1),disp."prazoAte") INTO prazo FROM "DisponibilizacaoSegundaChamada" disp WHERE disp."propostaId"=fonte.id;
 IF prazo IS NULL OR e.fim>prazo OR EXISTS(SELECT 1 FROM "RegistroAvaliacaoMatricula" rr JOIN "VersaoLancamentoAvaliacao" l ON l."registroId"=rr.id JOIN "DecisaoLancamentoAvaliacao" d ON d."lancamentoId"=l.id AND d.aprovada WHERE rr."matriculaId"=fonte."matriculaId" AND rr."alocacaoId"=fonte."alocacaoId" AND rr."turmaId"=fonte."turmaId" AND rr."regraId"=fonte."regraId" AND rr."codigoAvaliacao"=fonte."codigoAvaliacao") THEN RAISE EXCEPTION 'Prazo ou avaliação da substituição mudou'; END IF;
 IF (situacao_matricula_no_instante(fonte."matriculaId",e.inicio) IN ('PAUSADA','ENCERRADA') AND NOT autorizacao_especial_segunda_chamada_valida(fonte."alocacaoId",fonte."codigoAvaliacao",e.inicio)) OR (situacao_matricula_no_instante(fonte."matriculaId",e.fim-interval '1 millisecond') IN ('PAUSADA','ENCERRADA') AND NOT autorizacao_especial_segunda_chamada_valida(fonte."alocacaoId",fonte."codigoAvaliacao",e.fim-interval '1 millisecond')) THEN RAISE EXCEPTION 'Substituição exige autorização especial vigente durante o encontro'; END IF;
 IF EXISTS(SELECT 1 FROM "EncontroAgenda" x LEFT JOIN "Matricula" m ON m.id=x."matriculaId" WHERE x.id<>e.id AND x.status IN ('PREVISTO','MINISTRADO') AND x.inicio<e.fim AND x.fim>e.inicio AND (x."professorId"=p."substitutoId" OR m."alunoId"=(SELECT "alunoId" FROM "Matricula" WHERE id=fonte."matriculaId") OR (x."matriculaId" IS NULL AND EXISTS(SELECT 1 FROM "AlocacaoTurma" a WHERE a."alunoId"=(SELECT "alunoId" FROM "Matricula" WHERE id=fonte."matriculaId") AND a."turmaId"=x."turmaId" AND a."criadoEm"<e.fim AND a."criadoEm"<x.fim AND (a."encerradaEm" IS NULL OR (a."encerradaEm">e.inicio AND a."encerradaEm">x.inicio)))))) THEN RAISE EXCEPTION 'Conflito de agenda antes da substituição'; END IF;
 IF EXISTS(SELECT 1 FROM "IndisponibilidadeDocente" i JOIN "DecisaoIndisponibilidadeDocente" d ON d."indisponibilidadeId"=i.id AND d.aprovada WHERE i."professorId"=p."substitutoId" AND i.inicio<e.fim AND i.fim>e.inicio) OR EXISTS(SELECT 1 FROM "HorarioReservaParticular" h JOIN "ReservaAgendaParticular" rh ON rh.id=h."reservaId" JOIN "Matricula" rm ON rm.id=rh."matriculaId" WHERE rh.status IN ('ATIVA','MANTIDA_PENDENCIA') AND h.inicio<e.fim AND h.fim>e.inicio AND (h."professorId"=p."substitutoId" OR rm."alunoId"=(SELECT "alunoId" FROM "Matricula" WHERE id=fonte."matriculaId"))) THEN RAISE EXCEPTION 'Indisponibilidade ou reserva comercial conflitante'; END IF;
 designacao:='substituicao-segunda:'||NEW.id;
 INSERT INTO "DesignacaoSegundaChamada"(id,"propostaId","professorId","gestorId",versao,inicio,fim,motivo,"chaveIdempotencia","entradaHash","criadaEm") VALUES(designacao,fonte.id,p."substitutoId",NEW."decisorId",COALESCE((SELECT max(versao) FROM "DesignacaoSegundaChamada" WHERE "propostaId"=fonte.id),0)+1,agora,NULL,p.motivo,'substituicao-segunda:'||NEW.id,p."entradaHash",agora);
 INSERT INTO "AplicacaoSubstituicaoAgendaSegundaChamada"(id,"decisaoId","encontroId","professorAnteriorId","professorNovoId","designacaoId","aplicadaEm") VALUES('aplicacao-substituicao-segunda:'||NEW.id,NEW.id,e.id,e."professorId",p."substitutoId",designacao,agora);
 UPDATE "EncontroAgenda" SET "professorId"=p."substitutoId" WHERE id=e.id AND "professorId"=e."professorId"; IF NOT FOUND THEN RAISE EXCEPTION 'Professor do encontro mudou antes da substituição'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER aplicar_substituicao_agenda_segunda_chamada AFTER INSERT ON "DecisaoSubstituicaoAgendaSegundaChamada" FOR EACH ROW EXECUTE FUNCTION aplicar_substituicao_agenda_segunda_chamada();

CREATE FUNCTION conferir_aplicacao_substituicao_agenda_segunda_chamada_final() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "AplicacaoSubstituicaoAgendaSegundaChamada" x JOIN "DecisaoSubstituicaoAgendaSegundaChamada" d ON d.id=x."decisaoId" AND d.aprovada JOIN "PropostaSubstituicaoAgendaSegundaChamada" p ON p.id=d."propostaId" JOIN "EncontroAgenda" e ON e.id=x."encontroId" AND e."professorId"=x."professorNovoId" JOIN "DesignacaoSegundaChamada" g ON g.id=x."designacaoId" AND g."professorId"=x."professorNovoId" AND g."propostaId"=(p.snapshot#>>'{fonte,propostaSegundaChamadaId}') WHERE x.id=NEW.id) THEN RAISE EXCEPTION 'Aplicação de substituição incompleta'; END IF; RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER conferir_aplicacao_substituicao_agenda_segunda_chamada_final AFTER INSERT ON "AplicacaoSubstituicaoAgendaSegundaChamada" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION conferir_aplicacao_substituicao_agenda_segunda_chamada_final();
