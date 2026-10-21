CREATE OR REPLACE FUNCTION preservar_finalidade_encontro() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaAgendaRecuperacao"%ROWTYPE; contrato TEXT;
BEGIN
 IF TG_OP='UPDATE' AND NEW.finalidade<>OLD.finalidade THEN RAISE EXCEPTION 'Finalidade do encontro é imutável'; END IF;
 IF TG_OP='UPDATE' AND OLD."propostaAgendaRecuperacaoId" IS NOT NULL THEN
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

