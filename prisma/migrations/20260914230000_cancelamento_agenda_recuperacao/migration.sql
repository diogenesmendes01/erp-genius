CREATE TABLE "PropostaCancelamentoAgendaRecuperacao" (
 id TEXT NOT NULL PRIMARY KEY, "reservaId" TEXT NOT NULL, "autorId" TEXT NOT NULL,
 motivo TEXT NOT NULL, evidencia TEXT NOT NULL, snapshot JSONB NOT NULL,
 "chaveIdempotencia" TEXT NOT NULL, "entradaHash" TEXT NOT NULL, "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PropostaCancelamentoAgendaRecuperacao_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "ReservaTentativaRecuperacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "PropostaCancelamentoAgendaRecuperacao_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 CHECK (length(trim(motivo)) BETWEEN 5 AND 2000 AND length(trim(evidencia)) BETWEEN 5 AND 4000)
);
CREATE UNIQUE INDEX "PropostaCancelamentoAgendaRecuperacao_autorId_chaveIdempotencia_key" ON "PropostaCancelamentoAgendaRecuperacao"("autorId","chaveIdempotencia");
CREATE INDEX "PropostaCancelamentoAgendaRecuperacao_reservaId_criadaEm_idx" ON "PropostaCancelamentoAgendaRecuperacao"("reservaId","criadaEm");
CREATE TABLE "DecisaoCancelamentoAgendaRecuperacao" (
 id TEXT NOT NULL PRIMARY KEY, "propostaId" TEXT NOT NULL UNIQUE, "decisorId" TEXT NOT NULL,
 aprovada BOOLEAN NOT NULL, motivo TEXT NOT NULL, "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "DecisaoCancelamentoAgendaRecuperacao_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaCancelamentoAgendaRecuperacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "DecisaoCancelamentoAgendaRecuperacao_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 CHECK (length(trim(motivo)) BETWEEN 5 AND 2000)
);
ALTER TABLE "CancelamentoReservaRecuperacao" ADD COLUMN "propostaAgendaId" TEXT;
CREATE UNIQUE INDEX "CancelamentoReservaRecuperacao_propostaAgendaId_key" ON "CancelamentoReservaRecuperacao"("propostaAgendaId");
ALTER TABLE "CancelamentoReservaRecuperacao" ADD CONSTRAINT "CancelamentoReservaRecuperacao_propostaAgendaId_fkey" FOREIGN KEY ("propostaAgendaId") REFERENCES "PropostaCancelamentoAgendaRecuperacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION estado_cancelamento_agenda_recuperacao(reserva_id TEXT) RETURNS JSONB LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('reservaId',r.id,'matriculaId',pl."matriculaId",'cancelamentoId',c.id,'itens',
  (SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'habilidade',i.habilidade,'realizacaoId',realizada.id,'encontroId',e.id,'status',e.status,'inicio',e.inicio,'fim',e.fim,'professorId',e."professorId") ORDER BY i.id),'[]'::jsonb)
   FROM "ItemReservaTentativaRecuperacao" i LEFT JOIN "RealizacaoRecuperacao" realizada ON realizada."itemReservaId"=i.id
   LEFT JOIN "PropostaAgendaRecuperacao" pa ON pa."itemReservaId"=i.id AND EXISTS (SELECT 1 FROM "DecisaoAgendaRecuperacao" da WHERE da."propostaId"=pa.id AND da.aprovada)
   LEFT JOIN "EncontroAgenda" e ON e."propostaAgendaRecuperacaoId"=pa.id WHERE i."reservaId"=r.id))
 FROM "ReservaTentativaRecuperacao" r JOIN "PropostaPlanoRecuperacao" pl ON pl.id=r."propostaId" LEFT JOIN "CancelamentoReservaRecuperacao" c ON c."reservaId"=r.id WHERE r.id=reserva_id;
$$;

CREATE FUNCTION conferir_cancelamento_agenda_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaCancelamentoAgendaRecuperacao"%ROWTYPE; reserva_id TEXT; ator TEXT; atual JSONB;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Proposta e decisão de cancelamento são imutáveis'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 IF TG_TABLE_NAME='PropostaCancelamentoAgendaRecuperacao' THEN reserva_id:=NEW."reservaId"; ator:=NEW."autorId";
 ELSE SELECT * INTO proposta FROM "PropostaCancelamentoAgendaRecuperacao" WHERE id=NEW."propostaId"; reserva_id:=proposta."reservaId"; ator:=NEW."decisorId"; END IF;
 PERFORM m.id FROM "Matricula" m JOIN "PropostaPlanoRecuperacao" pl ON pl."matriculaId"=m.id JOIN "ReservaTentativaRecuperacao" r ON r."propostaId"=pl.id WHERE r.id=reserva_id FOR UPDATE OF m;
 PERFORM id FROM "Usuario" WHERE id=ator AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cancelamento da agenda exige gestão ativa'; END IF;
 IF TG_TABLE_NAME='DecisaoCancelamentoAgendaRecuperacao' THEN
  IF ator=proposta."autorId" THEN RAISE EXCEPTION 'Cancelamento exige aprovação de outra pessoa'; END IF;
  IF NOT NEW.aprovada THEN RETURN NEW; END IF;
 END IF;
 atual:=estado_cancelamento_agenda_recuperacao(reserva_id);
 IF atual IS NULL OR atual->>'cancelamentoId' IS NOT NULL OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(atual->'itens') i WHERE i->>'status'='PREVISTO' AND i->>'realizacaoId' IS NULL) THEN RAISE EXCEPTION 'Reserva sem agenda pendente para cancelar'; END IF;
 IF (TG_TABLE_NAME='PropostaCancelamentoAgendaRecuperacao' AND (to_jsonb(NEW)->'snapshot') IS DISTINCT FROM atual) THEN RAISE EXCEPTION 'Confira o alcance atual do cancelamento'; END IF;
 IF TG_TABLE_NAME='DecisaoCancelamentoAgendaRecuperacao' AND proposta.snapshot IS DISTINCT FROM atual THEN RAISE EXCEPTION 'A agenda ou realizações mudaram; prepare nova proposta'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_cancelamento_agenda_recuperacao BEFORE INSERT OR UPDATE OR DELETE ON "PropostaCancelamentoAgendaRecuperacao" FOR EACH ROW EXECUTE FUNCTION conferir_cancelamento_agenda_recuperacao();
CREATE TRIGGER conferir_cancelamento_agenda_recuperacao BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoCancelamentoAgendaRecuperacao" FOR EACH ROW EXECUTE FUNCTION conferir_cancelamento_agenda_recuperacao();

-- A reserva libera suas habilidades pendentes somente com origem aprovada conferida.
CREATE OR REPLACE FUNCTION proteger_tentativa_agendada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE item TEXT; reserva TEXT; origem TEXT;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 item:=to_jsonb(NEW)->>'itemReservaId'; reserva:=to_jsonb(NEW)->>'reservaId'; origem:=to_jsonb(NEW)->>'propostaAgendaId';
 IF TG_TABLE_NAME='CancelamentoReservaRecuperacao' AND origem IS NOT NULL THEN
  IF NOT EXISTS (SELECT 1 FROM "PropostaCancelamentoAgendaRecuperacao" p JOIN "DecisaoCancelamentoAgendaRecuperacao" d ON d."propostaId"=p.id AND d.aprovada WHERE p.id=origem AND p."reservaId"=reserva AND NEW."autorId"=d."decisorId" AND NEW.motivo=p.motivo AND NEW.evidencia=p.evidencia AND p.snapshot=estado_cancelamento_agenda_recuperacao(reserva)) THEN RAISE EXCEPTION 'Origem aprovada do cancelamento não confere'; END IF;
  RETURN NEW;
 END IF;
 IF EXISTS (SELECT 1 FROM "PropostaAgendaRecuperacao" p JOIN "EncontroAgenda" e ON e."propostaAgendaRecuperacaoId"=p.id JOIN "ItemReservaTentativaRecuperacao" i ON i.id=p."itemReservaId"
  WHERE (i.id=item OR i."reservaId"=reserva) AND e.status='PREVISTO') THEN RAISE EXCEPTION 'Tentativa agendada exige revisão específica da agenda aprovada'; END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION aplicar_cancelamento_agenda_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaCancelamentoAgendaRecuperacao"%ROWTYPE;
BEGIN
 IF NOT NEW.aprovada THEN RETURN NEW; END IF;
 SELECT * INTO p FROM "PropostaCancelamentoAgendaRecuperacao" WHERE id=NEW."propostaId";
 INSERT INTO "CancelamentoReservaRecuperacao" (id,"reservaId","autorId",motivo,evidencia,"propostaAgendaId") VALUES ('agenda:'||NEW.id,p."reservaId",NEW."decisorId",p.motivo,p.evidencia,p.id);
 UPDATE "EncontroAgenda" SET status='CANCELADO' WHERE status='PREVISTO' AND "propostaAgendaRecuperacaoId" IN
  (SELECT pa.id FROM "PropostaAgendaRecuperacao" pa JOIN "ItemReservaTentativaRecuperacao" i ON i.id=pa."itemReservaId" WHERE i."reservaId"=p."reservaId" AND NOT EXISTS (SELECT 1 FROM "RealizacaoRecuperacao" r WHERE r."itemReservaId"=i.id));
 RETURN NEW;
END $$;
CREATE TRIGGER aplicar_cancelamento_agenda_recuperacao AFTER INSERT ON "DecisaoCancelamentoAgendaRecuperacao" FOR EACH ROW EXECUTE FUNCTION aplicar_cancelamento_agenda_recuperacao();

CREATE OR REPLACE FUNCTION preservar_finalidade_encontro() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaAgendaRecuperacao"%ROWTYPE; contrato TEXT;
BEGIN
 IF TG_OP='UPDATE' AND NEW.finalidade<>OLD.finalidade THEN RAISE EXCEPTION 'Finalidade do encontro é imutável'; END IF;
 IF TG_OP='UPDATE' AND OLD."propostaAgendaRecuperacaoId" IS NOT NULL THEN
  IF OLD.status='PREVISTO' AND NEW.status='CANCELADO' AND (to_jsonb(OLD)-'status')=(to_jsonb(NEW)-'status') AND EXISTS (
   SELECT 1 FROM "PropostaAgendaRecuperacao" origem JOIN "ItemReservaTentativaRecuperacao" i ON i.id=origem."itemReservaId" JOIN "CancelamentoReservaRecuperacao" c ON c."reservaId"=i."reservaId" JOIN "DecisaoCancelamentoAgendaRecuperacao" d ON d."propostaId"=c."propostaAgendaId" AND d.aprovada WHERE origem.id=OLD."propostaAgendaRecuperacaoId" AND NOT EXISTS (SELECT 1 FROM "RealizacaoRecuperacao" r WHERE r."itemReservaId"=i.id)
  ) THEN RETURN NEW; END IF;
  IF OLD.status='PREVISTO' AND NEW.status='MINISTRADO' AND (to_jsonb(OLD)-'status')=(to_jsonb(NEW)-'status') AND EXISTS (
   SELECT 1 FROM "PropostaAgendaRecuperacao" origem JOIN "RealizacaoRecuperacao" r ON r."itemReservaId"=origem."itemReservaId" WHERE origem.id=OLD."propostaAgendaRecuperacaoId" AND r."professorId"=OLD."professorId" AND r."realizadaEm">=OLD.inicio AND r."realizadaEm"<OLD.fim
  ) THEN RETURN NEW; END IF;
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

