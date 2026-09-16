-- Q151: acrescenta a validação contratual contínua da migration 129 sem
-- remover as guardas, fontes ou locks existentes das duas materializações.

CREATE OR REPLACE FUNCTION aplicar_agenda_inicial_segunda() RETURNS trigger LANGUAGE plpgsql AS $$
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
 IF NOT situacao_autorizacao_segunda_chamada_cobre_intervalo(f."matriculaId",f."alocacaoId",f."codigoAvaliacao",p.inicio,p.fim) THEN
   RAISE EXCEPTION 'Situação contratual não permite todo o intervalo da agenda inicial';
 END IF;
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

CREATE OR REPLACE FUNCTION aplicar_substituicao_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
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
 IF NOT situacao_autorizacao_segunda_chamada_cobre_intervalo(fonte."matriculaId",fonte."alocacaoId",fonte."codigoAvaliacao",e.inicio,e.fim) THEN
   RAISE EXCEPTION 'Situação contratual da substituição não permite todo o encontro';
 END IF;
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
