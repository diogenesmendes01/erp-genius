CREATE TABLE "PropostaAgendaRecuperacao" (
 "id" TEXT NOT NULL PRIMARY KEY, "itemReservaId" TEXT NOT NULL, "autorId" TEXT NOT NULL,
 "versao" INTEGER NOT NULL, "inicio" TIMESTAMP(3) NOT NULL, "fim" TIMESTAMP(3) NOT NULL,
 "fusoOrigem" TEXT NOT NULL, "motivo" TEXT NOT NULL, "snapshot" JSONB NOT NULL,
 "chaveIdempotencia" TEXT NOT NULL, "entradaHash" TEXT NOT NULL,
 "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PropostaAgendaRecuperacao_itemReservaId_fkey" FOREIGN KEY ("itemReservaId") REFERENCES "ItemReservaTentativaRecuperacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "PropostaAgendaRecuperacao_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT proposta_agenda_recuperacao_conteudo CHECK (versao > 0 AND fim > inicio AND length(trim(motivo)) >= 5 AND jsonb_typeof(snapshot) = 'object')
);
CREATE UNIQUE INDEX "PropostaAgendaRecuperacao_itemReservaId_versao_key" ON "PropostaAgendaRecuperacao"("itemReservaId", "versao");
CREATE UNIQUE INDEX "PropostaAgendaRecuperacao_autorId_chaveIdempotencia_key" ON "PropostaAgendaRecuperacao"("autorId", "chaveIdempotencia");

CREATE FUNCTION preservar_proposta_agenda_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaPlanoRecuperacao"%ROWTYPE; a "AlocacaoTurma"%ROWTYPE; disp "DisponibilizacaoPlanoRecuperacao"%ROWTYPE; ultima INTEGER;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Proposta de agenda de recuperação é imutável'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
 SELECT plano.* INTO p FROM "ItemReservaTentativaRecuperacao" i JOIN "ReservaTentativaRecuperacao" r ON r.id = i."reservaId" JOIN "PropostaPlanoRecuperacao" plano ON plano.id = r."propostaId" WHERE i.id = NEW."itemReservaId";
 PERFORM id FROM "Matricula" WHERE id = p."matriculaId" AND status = 'ATIVA' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proposta exige matrícula ativa'; END IF;
 SELECT * INTO a FROM "AlocacaoTurma" WHERE id = p."alocacaoId";
 PERFORM id FROM "Turma" WHERE id = a."turmaId" AND "nivelId" = p."nivelId" AND "regraAvaliacaoId" = p."regraId" FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Confira turma e regra do plano'; END IF;
 PERFORM id FROM "AlocacaoTurma" WHERE id = a.id AND ativa AND "matriculaId" = p."matriculaId" FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Confira o vínculo ativo do plano'; END IF;
 PERFORM id FROM "Usuario" WHERE id = NEW."autorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proposta exige gestão pedagógica ativa'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "DecisaoPlanoRecuperacao" WHERE "propostaId" = p.id AND aprovada) THEN RAISE EXCEPTION 'Plano não aprovado'; END IF;
 IF EXISTS (SELECT 1 FROM "RealizacaoRecuperacao" WHERE "itemReservaId" = NEW."itemReservaId") OR EXISTS (SELECT 1 FROM "ItemReservaTentativaRecuperacao" i JOIN "CancelamentoReservaRecuperacao" c ON c."reservaId" = i."reservaId" WHERE i.id = NEW."itemReservaId") THEN RAISE EXCEPTION 'Tentativa realizada ou cancelada'; END IF;
 SELECT * INTO disp FROM "DisponibilizacaoPlanoRecuperacao" WHERE "propostaId" = p.id;
 IF disp.id IS NULL OR NEW.inicio <= (clock_timestamp() AT TIME ZONE 'UTC') OR NEW.inicio < disp."disponibilizadaEm" OR NEW.inicio >= prazo_recuperacao_vigente(disp.id) OR NEW.fim > prazo_recuperacao_vigente(disp.id) THEN RAISE EXCEPTION 'Confira intervalo futuro e prazo do plano'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW."fusoOrigem") THEN RAISE EXCEPTION 'Fuso inválido'; END IF;
 IF NEW.snapshot->>'itemReservaId' IS DISTINCT FROM NEW."itemReservaId" OR NEW.snapshot->>'planoId' IS DISTINCT FROM p.id OR NEW.snapshot->>'planoHash' IS DISTINCT FROM p."entradaHash" OR NEW.snapshot->>'fuso' IS DISTINCT FROM NEW."fusoOrigem" OR (NEW.snapshot->>'inicio')::timestamp IS DISTINCT FROM NEW.inicio OR (NEW.snapshot->>'fim')::timestamp IS DISTINCT FROM NEW.fim THEN RAISE EXCEPTION 'Proposta diverge da conferência'; END IF;
 SELECT coalesce(max(versao),0) INTO ultima FROM "PropostaAgendaRecuperacao" WHERE "itemReservaId" = NEW."itemReservaId";
 IF NEW.versao <> ultima + 1 THEN RAISE EXCEPTION 'Confira a versão mais recente da proposta'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER preservar_proposta_agenda_recuperacao BEFORE INSERT OR UPDATE OR DELETE ON "PropostaAgendaRecuperacao" FOR EACH ROW EXECUTE FUNCTION preservar_proposta_agenda_recuperacao();
