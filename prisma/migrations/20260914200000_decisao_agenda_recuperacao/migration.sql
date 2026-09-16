CREATE TABLE "DecisaoAgendaRecuperacao" (
 "id" TEXT NOT NULL PRIMARY KEY, "propostaId" TEXT NOT NULL UNIQUE,
 "decisorId" TEXT NOT NULL, "aprovada" BOOLEAN NOT NULL,
 "autorizarDiaNaoLetivo" BOOLEAN NOT NULL DEFAULT false, "motivo" TEXT NOT NULL,
 "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "DecisaoAgendaRecuperacao_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaAgendaRecuperacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "DecisaoAgendaRecuperacao_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT decisao_agenda_recuperacao_motivo CHECK (length(trim(motivo)) >= 5 AND (aprovada OR NOT "autorizarDiaNaoLetivo"))
);
ALTER TABLE "EncontroAgenda" ADD COLUMN "propostaAgendaRecuperacaoId" TEXT;
CREATE UNIQUE INDEX "EncontroAgenda_propostaAgendaRecuperacaoId_key" ON "EncontroAgenda"("propostaAgendaRecuperacaoId");
ALTER TABLE "EncontroAgenda" ADD CONSTRAINT "EncontroAgenda_propostaAgendaRecuperacaoId_fkey" FOREIGN KEY ("propostaAgendaRecuperacaoId") REFERENCES "PropostaAgendaRecuperacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION conferir_decisao_agenda_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaAgendaRecuperacao"%ROWTYPE; plano "PropostaPlanoRecuperacao"%ROWTYPE;
 a "AlocacaoTurma"%ROWTYPE; t "Turma"%ROWTYPE; m "Matricula"%ROWTYPE;
 disp "DisponibilizacaoPlanoRecuperacao"%ROWTYPE; cal "VersaoCalendarioEscolar"%ROWTYPE;
 docente TEXT; nao_letivo BOOLEAN;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisão de agenda é imutável'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
 SELECT * INTO p FROM "PropostaAgendaRecuperacao" WHERE id = NEW."propostaId";
 SELECT pl.* INTO plano FROM "ItemReservaTentativaRecuperacao" i JOIN "ReservaTentativaRecuperacao" r ON r.id=i."reservaId" JOIN "PropostaPlanoRecuperacao" pl ON pl.id=r."propostaId" WHERE i.id=p."itemReservaId";
 SELECT * INTO m FROM "Matricula" WHERE id=plano."matriculaId" FOR UPDATE;
 SELECT * INTO a FROM "AlocacaoTurma" WHERE id=plano."alocacaoId";
 SELECT * INTO t FROM "Turma" WHERE id=a."turmaId" FOR UPDATE;
 PERFORM id FROM "AlocacaoTurma" WHERE id=a.id FOR SHARE;
 PERFORM id FROM "Usuario" WHERE id=NEW."decisorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND OR NEW."decisorId" = p."autorId" THEN RAISE EXCEPTION 'Decisão exige outra pessoa da gestão ativa'; END IF;
 IF NOT NEW.aprovada THEN RETURN NEW; END IF;
 IF p.versao <> (SELECT max(versao) FROM "PropostaAgendaRecuperacao" WHERE "itemReservaId"=p."itemReservaId") THEN RAISE EXCEPTION 'Proposta superada'; END IF;
 IF EXISTS (SELECT 1 FROM "PropostaAgendaRecuperacao" pr JOIN "DecisaoAgendaRecuperacao" d ON d."propostaId"=pr.id AND d.aprovada WHERE pr."itemReservaId"=p."itemReservaId") THEN RAISE EXCEPTION 'Tentativa já possui agenda aprovada'; END IF;
 IF m.status <> 'ATIVA' OR NOT a.ativa OR a."matriculaId" IS DISTINCT FROM m.id OR t."nivelId" IS DISTINCT FROM plano."nivelId" OR t."regraAvaliacaoId" IS DISTINCT FROM plano."regraId" THEN RAISE EXCEPTION 'Confira contrato e vínculo do plano'; END IF;
 IF EXISTS (SELECT 1 FROM "RealizacaoRecuperacao" WHERE "itemReservaId"=p."itemReservaId") OR EXISTS (SELECT 1 FROM "ItemReservaTentativaRecuperacao" i JOIN "CancelamentoReservaRecuperacao" c ON c."reservaId"=i."reservaId" WHERE i.id=p."itemReservaId") THEN RAISE EXCEPTION 'Tentativa realizada ou cancelada'; END IF;
 SELECT * INTO disp FROM "DisponibilizacaoPlanoRecuperacao" WHERE "propostaId"=plano.id;
 IF disp.id IS NULL OR NOT EXISTS (SELECT 1 FROM "DecisaoPlanoRecuperacao" WHERE "propostaId"=plano.id AND aprovada) OR p.inicio <= (clock_timestamp() AT TIME ZONE 'UTC') OR p.inicio < disp."disponibilizadaEm" OR p.fim > prazo_recuperacao_vigente(disp.id) THEN RAISE EXCEPTION 'Confira prazo vigente do plano'; END IF;
 SELECT "professorId" INTO docente FROM "DesignacaoRecuperacao" WHERE "itemReservaId"=p."itemReservaId" ORDER BY versao DESC LIMIT 1;
 IF docente IS NULL THEN
  IF t.status = 'CONCLUIDA' OR NOT EXISTS (SELECT 1 FROM "VinculoDocente" v WHERE v."turmaId"=t.id AND v."professorId"=t."professorId" AND v."inicio" <= (clock_timestamp() AT TIME ZONE 'UTC') AND v."fim" IS NULL) THEN RAISE EXCEPTION 'Avaliador sem atribuição vigente'; END IF;
  docente := t."professorId";
 END IF;
 PERFORM id FROM "Usuario" WHERE id=docente AND ativo AND 'PROFESSOR'::"Papel"=ANY(papeis) FOR SHARE;
 IF NOT FOUND OR docente IS DISTINCT FROM p.snapshot->'professor'->>'id' THEN RAISE EXCEPTION 'Avaliador mudou ou está indisponível'; END IF;
 SELECT c.* INTO cal FROM "VersaoCalendarioEscolar" c JOIN "DecisaoCalendarioEscolar" d ON d."calendarioId"=c.id AND d.aprovada ORDER BY c.versao DESC LIMIT 1;
 IF cal.id IS NULL OR cal.id IS DISTINCT FROM p.snapshot->>'calendarioId' OR cal."fusoInstitucional" IS DISTINCT FROM (SELECT "fusoInstitucional" FROM "ConfiguracaoOperacional" WHERE id='escola') THEN RAISE EXCEPTION 'Calendário mudou ou não está publicado'; END IF;
 SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(cal.periodos) per WHERE
  ((p.inicio AT TIME ZONE 'UTC') AT TIME ZONE cal."fusoInstitucional")::date <= (per->>'fim')::date AND
  (((p.fim - interval '1 millisecond') AT TIME ZONE 'UTC') AT TIME ZONE cal."fusoInstitucional")::date >= (per->>'inicio')::date) INTO nao_letivo;
 IF nao_letivo <> NEW."autorizarDiaNaoLetivo" THEN RAISE EXCEPTION 'Confira a autorização explícita de dia não letivo'; END IF;
 IF EXISTS (SELECT 1 FROM "EncontroAgenda" e WHERE e.status IN ('PREVISTO','MINISTRADO') AND e.inicio < p.fim AND e.fim > p.inicio AND
  (e."professorId"=docente OR EXISTS (SELECT 1 FROM "Matricula" em WHERE em.id=e."matriculaId" AND em."alunoId"=m."alunoId") OR EXISTS (SELECT 1 FROM "AlocacaoTurma" v WHERE v."alunoId"=m."alunoId" AND v."turmaId"=e."turmaId" AND v."criadoEm" < least(e.fim,p.fim) AND (v."encerradaEm" IS NULL OR v."encerradaEm">greatest(e.inicio,p.inicio))))) THEN RAISE EXCEPTION 'Agenda em conflito com avaliador ou aluno'; END IF;
 IF EXISTS (SELECT 1 FROM "IndisponibilidadeDocente" i JOIN "DecisaoIndisponibilidadeDocente" d ON d."indisponibilidadeId"=i.id AND d.aprovada WHERE i."professorId"=docente AND i.inicio<p.fim AND i.fim>p.inicio) THEN RAISE EXCEPTION 'Avaliador com indisponibilidade aprovada'; END IF;
 IF EXISTS (SELECT 1 FROM "HorarioReservaParticular" h JOIN "ReservaAgendaParticular" r ON r.id=h."reservaId" JOIN "Matricula" rm ON rm.id=r."matriculaId" WHERE r.status IN ('ATIVA','MANTIDA_PENDENCIA') AND h.inicio<p.fim AND h.fim>p.inicio AND (h."professorId"=docente OR rm."alunoId"=m."alunoId")) THEN RAISE EXCEPTION 'Conflito com reserva comercial'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_decisao_agenda_recuperacao BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoAgendaRecuperacao" FOR EACH ROW EXECUTE FUNCTION conferir_decisao_agenda_recuperacao();

CREATE OR REPLACE FUNCTION preservar_finalidade_encontro() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaAgendaRecuperacao"%ROWTYPE; contrato TEXT;
BEGIN
 IF TG_OP='UPDATE' AND NEW.finalidade<>OLD.finalidade THEN RAISE EXCEPTION 'Finalidade do encontro é imutável'; END IF;
 IF NEW.finalidade='AULA' AND NEW."propostaAgendaRecuperacaoId" IS NOT NULL THEN RAISE EXCEPTION 'Origem de recuperação não corresponde a aula'; END IF;
 IF NEW.finalidade='RECUPERACAO' AND (NEW.status<>'RASCUNHO' OR NEW."propostaAgendaRecuperacaoId" IS NOT NULL) THEN
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Agenda de recuperação exige fluxo específico para alteração'; END IF;
  SELECT * INTO p FROM "PropostaAgendaRecuperacao" WHERE id=NEW."propostaAgendaRecuperacaoId";
  SELECT pl."matriculaId" INTO contrato FROM "ItemReservaTentativaRecuperacao" i JOIN "ReservaTentativaRecuperacao" r ON r.id=i."reservaId" JOIN "PropostaPlanoRecuperacao" pl ON pl.id=r."propostaId" WHERE i.id=p."itemReservaId";
  IF p.id IS NULL OR NOT EXISTS (SELECT 1 FROM "DecisaoAgendaRecuperacao" WHERE "propostaId"=p.id AND aprovada) OR NEW.status<>'PREVISTO' OR NEW."matriculaId" IS DISTINCT FROM contrato OR NEW."professorId" IS DISTINCT FROM p.snapshot->'professor'->>'id' OR NEW.inicio<>p.inicio OR NEW.fim<>p.fim OR NEW."fusoOrigem"<>p."fusoOrigem" OR NEW."preparadorId"<>p."autorId" THEN RAISE EXCEPTION 'Publicação de recuperação exige o fluxo específico de aprovação'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION publicar_agenda_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaAgendaRecuperacao"%ROWTYPE; contrato TEXT;
BEGIN
 IF NOT NEW.aprovada THEN RETURN NEW; END IF;
 SELECT * INTO p FROM "PropostaAgendaRecuperacao" WHERE id=NEW."propostaId";
 SELECT pl."matriculaId" INTO contrato FROM "ItemReservaTentativaRecuperacao" i JOIN "ReservaTentativaRecuperacao" r ON r.id=i."reservaId" JOIN "PropostaPlanoRecuperacao" pl ON pl.id=r."propostaId" WHERE i.id=p."itemReservaId";
 INSERT INTO "EncontroAgenda" (id,finalidade,"propostaAgendaRecuperacaoId","matriculaId","professorId","preparadorId",inicio,fim,"fusoOrigem",status,motivo,"chaveIdempotencia","entradaHash")
 VALUES ('recuperacao:'||NEW.id,'RECUPERACAO',p.id,contrato,p.snapshot->'professor'->>'id',p."autorId",p.inicio,p.fim,p."fusoOrigem",'PREVISTO',p.motivo,'recuperacao:'||p.id,p."entradaHash");
 RETURN NEW;
END $$;
CREATE TRIGGER publicar_agenda_recuperacao AFTER INSERT ON "DecisaoAgendaRecuperacao" FOR EACH ROW EXECUTE FUNCTION publicar_agenda_recuperacao();
