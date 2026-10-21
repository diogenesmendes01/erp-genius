-- AlterTable
ALTER TABLE "RealizacaoRecuperacao" ADD COLUMN     "motivoRegularizacao" TEXT,
ADD COLUMN     "registradaPorId" TEXT;

-- AddForeignKey
ALTER TABLE "RealizacaoRecuperacao" ADD CONSTRAINT "RealizacaoRecuperacao_registradaPorId_fkey" FOREIGN KEY ("registradaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE OR REPLACE FUNCTION preservar_realizacao_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaPlanoRecuperacao"%ROWTYPE; reserva "ReservaTentativaRecuperacao"%ROWTYPE; disp "DisponibilizacaoPlanoRecuperacao"%ROWTYPE; a "AlocacaoTurma"%ROWTYPE; registrador TEXT; historico TEXT;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Realização de recuperação é imutável'; END IF;
 SELECT r.* INTO reserva FROM "ItemReservaTentativaRecuperacao" i JOIN "ReservaTentativaRecuperacao" r ON r.id = i."reservaId" WHERE i.id = NEW."itemReservaId";
 SELECT * INTO p FROM "PropostaPlanoRecuperacao" WHERE id = reserva."propostaId";
 PERFORM id FROM "Matricula" WHERE id = p."matriculaId" FOR UPDATE;
 IF EXISTS (SELECT 1 FROM "CancelamentoReservaRecuperacao" WHERE "reservaId" = reserva.id) THEN RAISE EXCEPTION 'Tentativa cancelada'; END IF;
 SELECT * INTO disp FROM "DisponibilizacaoPlanoRecuperacao" WHERE "propostaId" = p.id;
 IF disp.id IS NULL OR NEW."realizadaEm" < reserva."criadaEm" OR NEW."realizadaEm" < disp."disponibilizadaEm" OR NEW."realizadaEm" >= prazo_recuperacao_na_data(disp.id, NEW."realizadaEm") OR NEW."realizadaEm" > (clock_timestamp() AT TIME ZONE 'UTC') THEN RAISE EXCEPTION 'Realização fora do período autorizado'; END IF;
 registrador := COALESCE(NEW."registradaPorId", NEW."professorId");
 PERFORM id FROM "Usuario" WHERE id = registrador AND ativo AND 'PROFESSOR'::"Papel" = ANY(papeis) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Realização exige professor ativo'; END IF;
 SELECT * INTO a FROM "AlocacaoTurma" WHERE id = p."alocacaoId";
 IF NEW."realizadaEm" < a."criadoEm" OR (a."encerradaEm" IS NOT NULL AND NEW."realizadaEm" >= a."encerradaEm") OR (NOT a.ativa AND a."encerradaEm" IS NULL) THEN RAISE EXCEPTION 'Realização fora do vínculo do aluno'; END IF;
 IF registrador <> NEW."professorId" THEN
   IF NOT recuperacao_designada(NEW."itemReservaId", registrador) OR COALESCE(length(btrim(NEW."motivoRegularizacao")),0) < 5 OR length(NEW."motivoRegularizacao") > 2000 THEN RAISE EXCEPTION 'Regularização exige designação específica e motivo'; END IF;
 ELSE
   IF NEW."motivoRegularizacao" IS NOT NULL THEN RAISE EXCEPTION 'Motivo de regularização exige outro realizador'; END IF;
   IF NOT EXISTS (SELECT 1 FROM "Turma" t JOIN "VinculoDocente" v ON v."turmaId" = t.id WHERE t.id = a."turmaId" AND t."professorId" = registrador AND t.status <> 'CONCLUIDA' AND v."professorId" = registrador AND v.fim IS NULL AND v.inicio <= (clock_timestamp() AT TIME ZONE 'UTC')) AND NOT recuperacao_designada(NEW."itemReservaId", registrador) THEN RAISE EXCEPTION 'Registrador sem atribuição vigente'; END IF;
 END IF;
 SELECT "professorId" INTO historico FROM "DesignacaoRecuperacao" WHERE "itemReservaId" = NEW."itemReservaId" AND "criadaEm" <= NEW."realizadaEm" ORDER BY versao DESC LIMIT 1;
 IF NOT EXISTS (SELECT 1 FROM "VinculoDocente" WHERE "turmaId" = a."turmaId" AND "professorId" = NEW."professorId" AND inicio <= NEW."realizadaEm" AND (fim IS NULL OR NEW."realizadaEm" < fim)) AND historico IS DISTINCT FROM NEW."professorId" THEN RAISE EXCEPTION 'Realizador sem vínculo histórico'; END IF;
 IF COALESCE(length(btrim(NEW.evidencia)),0) < 5 OR length(NEW.evidencia) > 4000 THEN RAISE EXCEPTION 'Registre evidência da realização'; END IF;
 RETURN NEW;
END;
$$;
