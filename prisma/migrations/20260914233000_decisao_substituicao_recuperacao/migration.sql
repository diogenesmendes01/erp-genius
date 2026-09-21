CREATE TABLE "DecisaoSubstituicaoRecuperacao" (
 id TEXT NOT NULL PRIMARY KEY, "propostaId" TEXT NOT NULL UNIQUE, "decisorId" TEXT NOT NULL,
 aprovada BOOLEAN NOT NULL, motivo TEXT NOT NULL, "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "DecisaoSubstituicaoRecuperacao_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaSubstituicaoRecuperacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "DecisaoSubstituicaoRecuperacao_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT decisao_substituicao_recuperacao_motivo CHECK (length(trim(motivo)) BETWEEN 5 AND 2000)
);
ALTER TABLE "DesignacaoRecuperacao" ADD COLUMN "decisaoSubstituicaoId" TEXT;
CREATE UNIQUE INDEX "DesignacaoRecuperacao_decisaoSubstituicaoId_key" ON "DesignacaoRecuperacao"("decisaoSubstituicaoId");
ALTER TABLE "DesignacaoRecuperacao" ADD CONSTRAINT "DesignacaoRecuperacao_decisaoSubstituicaoId_fkey" FOREIGN KEY ("decisaoSubstituicaoId") REFERENCES "DecisaoSubstituicaoRecuperacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- A decisão aprovada só aceita a versão e a fotografia da agenda ainda vigentes.
CREATE FUNCTION conferir_decisao_substituicao_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaSubstituicaoRecuperacao"%ROWTYPE; e "EncontroAgenda"%ROWTYPE; item_id TEXT;
 plano "PropostaPlanoRecuperacao"%ROWTYPE; alocacao "AlocacaoTurma"%ROWTYPE; turma "Turma"%ROWTYPE; disp "DisponibilizacaoPlanoRecuperacao"%ROWTYPE; cal "VersaoCalendarioEscolar"%ROWTYPE;
 ultima_designacao INTEGER;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Decisão de substituição é imutável'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO p FROM "PropostaSubstituicaoRecuperacao" WHERE id=NEW."propostaId";
 IF p.id IS NULL THEN RAISE EXCEPTION 'Proposta de substituição não encontrada'; END IF;
 PERFORM id FROM "Usuario" WHERE id=NEW."decisorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND OR NEW."decisorId"=p."autorId" THEN RAISE EXCEPTION 'Decisão exige outra pessoa da gestão ativa'; END IF;
 IF length(btrim(NEW.motivo))<5 OR length(NEW.motivo)>2000 THEN RAISE EXCEPTION 'Justifique a decisão'; END IF;
 IF NOT NEW.aprovada THEN RETURN NEW; END IF;
 SELECT * INTO e FROM "EncontroAgenda" WHERE id=p."encontroId" FOR UPDATE;
 SELECT "itemReservaId" INTO item_id FROM "PropostaAgendaRecuperacao" WHERE id=e."propostaAgendaRecuperacaoId";
 SELECT pl.* INTO plano FROM "ItemReservaTentativaRecuperacao" i JOIN "ReservaTentativaRecuperacao" r ON r.id=i."reservaId" JOIN "PropostaPlanoRecuperacao" pl ON pl.id=r."propostaId" WHERE i.id=item_id;
 SELECT * INTO alocacao FROM "AlocacaoTurma" WHERE id=plano."alocacaoId";
 SELECT * INTO turma FROM "Turma" WHERE id=alocacao."turmaId";
 SELECT * INTO disp FROM "DisponibilizacaoPlanoRecuperacao" WHERE "propostaId"=plano.id;
 PERFORM id FROM "Matricula" WHERE id=plano."matriculaId" AND status='ATIVA' FOR UPDATE;
 IF NOT FOUND OR e.finalidade<>'RECUPERACAO' OR e.status<>'PREVISTO' OR e.inicio <= (clock_timestamp() AT TIME ZONE 'UTC') OR NOT alocacao.ativa OR alocacao."matriculaId" IS DISTINCT FROM plano."matriculaId" OR turma."nivelId" IS DISTINCT FROM plano."nivelId" OR turma."regraAvaliacaoId" IS DISTINCT FROM plano."regraId" THEN RAISE EXCEPTION 'Substituição exige agenda futura e contrato vigente'; END IF;
 IF disp.id IS NULL OR e.inicio<disp."disponibilizadaEm" OR e.inicio>=prazo_recuperacao_vigente(disp.id) OR e.fim>prazo_recuperacao_vigente(disp.id) THEN RAISE EXCEPTION 'Confira o prazo vigente da recuperação'; END IF;
 SELECT c.* INTO cal FROM "VersaoCalendarioEscolar" c JOIN "DecisaoCalendarioEscolar" dc ON dc."calendarioId"=c.id AND dc.aprovada ORDER BY c.versao DESC LIMIT 1;
 IF cal.id IS NULL OR cal.id IS DISTINCT FROM p.snapshot->>'calendarioId' OR cal."fusoInstitucional" IS DISTINCT FROM (SELECT "fusoInstitucional" FROM "ConfiguracaoOperacional" WHERE id='escola') THEN RAISE EXCEPTION 'Calendário ou fuso mudou desde a conferência'; END IF;
 IF p.versao<>(SELECT max(versao) FROM "PropostaSubstituicaoRecuperacao" WHERE "encontroId"=e.id) THEN RAISE EXCEPTION 'Proposta de substituição superada'; END IF;
 IF EXISTS (SELECT 1 FROM "RealizacaoRecuperacao" WHERE "itemReservaId"=item_id) OR EXISTS (SELECT 1 FROM "ItemReservaTentativaRecuperacao" i JOIN "CancelamentoReservaRecuperacao" c ON c."reservaId"=i."reservaId" WHERE i.id=item_id) THEN RAISE EXCEPTION 'Tentativa já realizada ou cancelada'; END IF;
 PERFORM id FROM "Usuario" WHERE id=p."substitutoId" AND ativo AND 'PROFESSOR'::"Papel"=ANY(papeis) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Substituto precisa ser professor ativo'; END IF;
 SELECT coalesce(max(versao),0) INTO ultima_designacao FROM "DesignacaoRecuperacao" WHERE "itemReservaId"=item_id;
 IF p.snapshot->>'encontroId' IS DISTINCT FROM e.id OR p.snapshot->>'itemReservaId' IS DISTINCT FROM item_id OR p.snapshot->>'matriculaId' IS DISTINCT FROM e."matriculaId" OR p.snapshot->>'avaliadorAtualId' IS DISTINCT FROM e."professorId" OR p.snapshot->>'substitutoId' IS DISTINCT FROM p."substitutoId" OR p.snapshot->>'planoHash' IS DISTINCT FROM plano."entradaHash" OR (p.snapshot->>'inicio')::timestamp IS DISTINCT FROM e.inicio OR (p.snapshot->>'fim')::timestamp IS DISTINCT FROM e.fim OR p.snapshot->>'fusoOrigem' IS DISTINCT FROM e."fusoOrigem" OR p.snapshot->>'versaoDesignacao' IS DISTINCT FROM ultima_designacao::text THEN RAISE EXCEPTION 'Origem aprovada da substituição não confere'; END IF;
 IF EXISTS (
  SELECT 1 FROM "EncontroAgenda" conflito
  WHERE conflito.id<>e.id AND conflito.status IN ('PREVISTO','MINISTRADO')
   AND conflito.inicio<e.fim AND conflito.fim>e.inicio
   AND (
    conflito."professorId"=p."substitutoId"
    OR EXISTS (
     SELECT 1 FROM "Matricula" em JOIN "Matricula" atual ON atual.id=plano."matriculaId"
     WHERE em.id=conflito."matriculaId" AND em."alunoId"=atual."alunoId"
    )
    OR EXISTS (
     SELECT 1 FROM "AlocacaoTurma" v JOIN "Matricula" atual ON atual.id=plano."matriculaId"
     WHERE v."alunoId"=atual."alunoId" AND v."turmaId"=conflito."turmaId"
      AND v."criadoEm"<least(conflito.fim,e.fim)
      AND (v."encerradaEm" IS NULL OR v."encerradaEm">greatest(conflito.inicio,e.inicio))
    )
   )
 ) THEN RAISE EXCEPTION 'Há encontro conflitante do substituto ou aluno'; END IF;
 IF EXISTS (SELECT 1 FROM "IndisponibilidadeDocente" indisponibilidade JOIN "DecisaoIndisponibilidadeDocente" decisao_ausencia ON decisao_ausencia."indisponibilidadeId"=indisponibilidade.id AND decisao_ausencia.aprovada WHERE indisponibilidade."professorId"=p."substitutoId" AND indisponibilidade.inicio<e.fim AND indisponibilidade.fim>e.inicio) THEN RAISE EXCEPTION 'Substituto possui indisponibilidade aprovada'; END IF;
 IF EXISTS (SELECT 1 FROM "HorarioReservaParticular" horario JOIN "ReservaAgendaParticular" reserva ON reserva.id=horario."reservaId" JOIN "Matricula" rm ON rm.id=reserva."matriculaId" JOIN "Matricula" atual ON atual.id=plano."matriculaId" WHERE horario.inicio<e.fim AND horario.fim>e.inicio AND reserva.status IN ('ATIVA','MANTIDA_PENDENCIA') AND (horario."professorId"=p."substitutoId" OR rm."alunoId"=atual."alunoId")) THEN RAISE EXCEPTION 'Há reserva comercial conflitante'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_decisao_substituicao_recuperacao BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoSubstituicaoRecuperacao" FOR EACH ROW EXECUTE FUNCTION conferir_decisao_substituicao_recuperacao();

-- A origem aprovada é obrigatória para furar a proteção já existente da agenda publicada.
CREATE OR REPLACE FUNCTION proteger_tentativa_agendada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE item TEXT; reserva TEXT; origem TEXT; origem_substituicao TEXT;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 item:=to_jsonb(NEW)->>'itemReservaId'; reserva:=to_jsonb(NEW)->>'reservaId'; origem:=to_jsonb(NEW)->>'propostaAgendaId'; origem_substituicao:=to_jsonb(NEW)->>'decisaoSubstituicaoId';
 IF TG_TABLE_NAME='DesignacaoRecuperacao' AND origem_substituicao IS NOT NULL THEN
  IF NOT EXISTS (SELECT 1 FROM "DecisaoSubstituicaoRecuperacao" d JOIN "PropostaSubstituicaoRecuperacao" p ON p.id=d."propostaId" JOIN "EncontroAgenda" e ON e.id=p."encontroId" WHERE d.id=origem_substituicao AND d.aprovada AND p."substitutoId" IS NOT DISTINCT FROM NEW."professorId" AND p.snapshot->>'itemReservaId'=NEW."itemReservaId" AND NEW."gestorId"=d."decisorId" AND NEW.versao=(p.snapshot->>'versaoDesignacao')::integer+1 AND e.status='PREVISTO' AND e."professorId"=p.snapshot->>'avaliadorAtualId' AND NOT EXISTS (SELECT 1 FROM "DesignacaoRecuperacao" anterior WHERE anterior."itemReservaId"=NEW."itemReservaId" AND anterior.versao>=NEW.versao)) THEN RAISE EXCEPTION 'Origem aprovada da designação não confere'; END IF;
  RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='CancelamentoReservaRecuperacao' AND origem IS NOT NULL THEN
  IF NOT EXISTS (SELECT 1 FROM "PropostaCancelamentoAgendaRecuperacao" p JOIN "DecisaoCancelamentoAgendaRecuperacao" d ON d."propostaId"=p.id AND d.aprovada WHERE p.id=origem AND p."reservaId"=reserva AND NEW."autorId"=d."decisorId" AND NEW.motivo=p.motivo AND NEW.evidencia=p.evidencia AND p.snapshot=estado_cancelamento_agenda_recuperacao(reserva)) THEN RAISE EXCEPTION 'Origem aprovada do cancelamento não confere'; END IF;
  RETURN NEW;
 END IF;
 IF EXISTS (SELECT 1 FROM "PropostaAgendaRecuperacao" p JOIN "EncontroAgenda" e ON e."propostaAgendaRecuperacaoId"=p.id JOIN "ItemReservaTentativaRecuperacao" i ON i.id=p."itemReservaId" WHERE (i.id=item OR i."reservaId"=reserva) AND e.status='PREVISTO') THEN RAISE EXCEPTION 'Tentativa agendada exige revisão específica da agenda aprovada'; END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION aplicar_decisao_substituicao_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaSubstituicaoRecuperacao"%ROWTYPE; item_id TEXT;
BEGIN
 IF NOT NEW.aprovada THEN RETURN NEW; END IF;
 SELECT * INTO p FROM "PropostaSubstituicaoRecuperacao" WHERE id=NEW."propostaId";
 SELECT "itemReservaId" INTO item_id FROM "PropostaAgendaRecuperacao" pa JOIN "EncontroAgenda" e ON e."propostaAgendaRecuperacaoId"=pa.id WHERE e.id=p."encontroId";
 INSERT INTO "DesignacaoRecuperacao" (id,"itemReservaId",versao,"professorId","gestorId",motivo,"chaveIdempotencia","entradaHash","decisaoSubstituicaoId") VALUES ('substituicao-designacao:'||NEW.id,item_id,(p.snapshot->>'versaoDesignacao')::integer+1,p."substitutoId",NEW."decisorId",p.motivo,'substituicao:'||NEW.id,p."entradaHash",NEW.id);
 UPDATE "EncontroAgenda" SET "professorId"=p."substitutoId" WHERE id=p."encontroId";
 RETURN NEW;
END $$;
CREATE TRIGGER aplicar_decisao_substituicao_recuperacao AFTER INSERT ON "DecisaoSubstituicaoRecuperacao" FOR EACH ROW EXECUTE FUNCTION aplicar_decisao_substituicao_recuperacao();

CREATE OR REPLACE FUNCTION preservar_finalidade_encontro() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaAgendaRecuperacao"%ROWTYPE; contrato TEXT;
BEGIN
 IF TG_OP='UPDATE' AND NEW.finalidade<>OLD.finalidade THEN RAISE EXCEPTION 'Finalidade do encontro é imutável'; END IF;
 IF TG_OP='UPDATE' AND OLD."propostaAgendaRecuperacaoId" IS NOT NULL THEN
  IF OLD.status='PREVISTO' AND NEW.status='CANCELADO' AND (to_jsonb(OLD)-'status')=(to_jsonb(NEW)-'status') AND EXISTS (SELECT 1 FROM "PropostaAgendaRecuperacao" origem JOIN "ItemReservaTentativaRecuperacao" i ON i.id=origem."itemReservaId" JOIN "CancelamentoReservaRecuperacao" c ON c."reservaId"=i."reservaId" JOIN "DecisaoCancelamentoAgendaRecuperacao" d ON d."propostaId"=c."propostaAgendaId" AND d.aprovada WHERE origem.id=OLD."propostaAgendaRecuperacaoId" AND NOT EXISTS (SELECT 1 FROM "RealizacaoRecuperacao" r WHERE r."itemReservaId"=i.id)) THEN RETURN NEW; END IF;
  IF OLD.status='PREVISTO' AND NEW.status='MINISTRADO' AND (to_jsonb(OLD)-'status')=(to_jsonb(NEW)-'status') AND EXISTS (SELECT 1 FROM "PropostaAgendaRecuperacao" origem JOIN "RealizacaoRecuperacao" r ON r."itemReservaId"=origem."itemReservaId" WHERE origem.id=OLD."propostaAgendaRecuperacaoId" AND r."professorId"=OLD."professorId" AND r."realizadaEm">=OLD.inicio AND r."realizadaEm"<OLD.fim) THEN RETURN NEW; END IF;
  IF OLD.status='PREVISTO' AND NEW.status='PREVISTO' AND (to_jsonb(OLD)-'professorId')=(to_jsonb(NEW)-'professorId') AND EXISTS (SELECT 1 FROM "DecisaoSubstituicaoRecuperacao" d JOIN "PropostaSubstituicaoRecuperacao" s ON s.id=d."propostaId" JOIN "DesignacaoRecuperacao" designacao ON designacao."decisaoSubstituicaoId"=d.id WHERE d.aprovada AND s."encontroId"=OLD.id AND s.versao=(SELECT max(versao) FROM "PropostaSubstituicaoRecuperacao" WHERE "encontroId"=OLD.id) AND s."substitutoId" IS NOT DISTINCT FROM NEW."professorId" AND s.snapshot->>'avaliadorAtualId' IS NOT DISTINCT FROM OLD."professorId" AND designacao."professorId" IS NOT DISTINCT FROM NEW."professorId" AND designacao."itemReservaId"=s.snapshot->>'itemReservaId' AND designacao.versao=(s.snapshot->>'versaoDesignacao')::integer+1 AND designacao.versao=(SELECT max(versao) FROM "DesignacaoRecuperacao" WHERE "itemReservaId"=designacao."itemReservaId")) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Agenda de recuperação aprovada é imutável fora do fluxo específico';
 END IF;
 IF NEW.finalidade='AULA' AND NEW."propostaAgendaRecuperacaoId" IS NOT NULL THEN RAISE EXCEPTION 'Origem de recuperação não corresponde a aula'; END IF;
 IF NEW.finalidade='RECUPERACAO' AND (NEW.status<>'RASCUNHO' OR NEW."propostaAgendaRecuperacaoId" IS NOT NULL) THEN
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Publicação de recuperação exige o fluxo específico de aprovação'; END IF;
  SELECT * INTO p FROM "PropostaAgendaRecuperacao" WHERE id=NEW."propostaAgendaRecuperacaoId";
  SELECT pl."matriculaId" INTO contrato FROM "ItemReservaTentativaRecuperacao" i JOIN "ReservaTentativaRecuperacao" r ON r.id=i."reservaId" JOIN "PropostaPlanoRecuperacao" pl ON pl.id=r."propostaId" WHERE i.id=p."itemReservaId";
  IF p.id IS NULL OR NOT EXISTS (SELECT 1 FROM "DecisaoAgendaRecuperacao" WHERE "propostaId"=p.id AND aprovada) OR NEW.status<>'PREVISTO' OR NEW."matriculaId" IS DISTINCT FROM contrato OR NEW."professorId" IS DISTINCT FROM p.snapshot->'professor'->>'id' OR NEW.inicio<>p.inicio OR NEW.fim<>p.fim OR NEW."fusoOrigem"<>p."fusoOrigem" OR NEW."preparadorId"<>p."autorId" THEN RAISE EXCEPTION 'Publicação de recuperação exige o fluxo específico de aprovação'; END IF;
 END IF;
 RETURN NEW;
END $$;
