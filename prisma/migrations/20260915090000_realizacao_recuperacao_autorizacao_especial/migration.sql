-- Q151: a autorização especial somente permite registrar uma realização fora
-- da vigência da alocação que a originou; ela não flexibiliza os demais fatos.
ALTER TABLE "RealizacaoRecuperacao" ADD COLUMN "autorizacaoEspecialId" TEXT;
ALTER TABLE "RealizacaoRecuperacao"
  ADD CONSTRAINT "RealizacaoRecuperacao_autorizacaoEspecialId_fkey"
  FOREIGN KEY ("autorizacaoEspecialId") REFERENCES "AutorizacaoEspecialRecuperacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE OR REPLACE FUNCTION preservar_realizacao_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  p "PropostaPlanoRecuperacao"%ROWTYPE;
  reserva "ReservaTentativaRecuperacao"%ROWTYPE;
  disp "DisponibilizacaoPlanoRecuperacao"%ROWTYPE;
  a "AlocacaoTurma"%ROWTYPE;
  autorizacao "AutorizacaoEspecialRecuperacao"%ROWTYPE;
  registrador TEXT;
  historico TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Realização de recuperação é imutável'; END IF;
  SELECT r.* INTO reserva FROM "ItemReservaTentativaRecuperacao" i JOIN "ReservaTentativaRecuperacao" r ON r.id = i."reservaId" WHERE i.id = NEW."itemReservaId";
  SELECT * INTO p FROM "PropostaPlanoRecuperacao" WHERE id = reserva."propostaId";
  PERFORM id FROM "Matricula" WHERE id = p."matriculaId" FOR UPDATE;
  IF EXISTS (SELECT 1 FROM "CancelamentoReservaRecuperacao" WHERE "reservaId" = reserva.id) THEN RAISE EXCEPTION 'Tentativa cancelada'; END IF;
  SELECT * INTO disp FROM "DisponibilizacaoPlanoRecuperacao" WHERE "propostaId" = p.id;
  IF disp.id IS NULL OR NEW."realizadaEm" < reserva."criadaEm" OR NEW."realizadaEm" < disp."disponibilizadaEm" OR NEW."realizadaEm" >= prazo_recuperacao_na_data(disp.id, NEW."realizadaEm") OR NEW."realizadaEm" > (clock_timestamp() AT TIME ZONE 'UTC') THEN RAISE EXCEPTION 'Realização fora do período autorizado'; END IF;

  IF NEW."autorizacaoEspecialId" IS NOT NULL THEN
    SELECT * INTO autorizacao FROM "AutorizacaoEspecialRecuperacao" WHERE id = NEW."autorizacaoEspecialId" FOR SHARE;
    IF NOT FOUND
       OR autorizacao."itemReservaId" IS DISTINCT FROM NEW."itemReservaId"
       OR autorizacao."criadaEm" > NEW."realizadaEm"
       OR NEW."realizadaEm" > autorizacao."prazoAte" THEN
      RAISE EXCEPTION 'Autorização especial não é válida para esta realização';
    END IF;
    PERFORM id FROM "Usuario"
      WHERE id = autorizacao."autorizadorId" AND ativo
        AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]
      FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Autorizador especial precisa permanecer gestor ativo'; END IF;
    IF jsonb_typeof(autorizacao.snapshot) IS DISTINCT FROM 'object'
       OR autorizacao.snapshot->>'matriculaId' IS DISTINCT FROM p."matriculaId"
       OR autorizacao.snapshot->>'alocacaoId' IS DISTINCT FROM p."alocacaoId"
       OR autorizacao.snapshot->>'regraId' IS DISTINCT FROM p."regraId"
       OR autorizacao.snapshot->>'propostaId' IS DISTINCT FROM p.id
       OR autorizacao.snapshot->>'propostaHash' IS DISTINCT FROM p."entradaHash"
       OR autorizacao.snapshot->>'decisaoId' IS DISTINCT FROM (
         SELECT id FROM "DecisaoPlanoRecuperacao" WHERE "propostaId" = p.id AND aprovada
       )
       OR autorizacao.snapshot->>'disponibilizacaoId' IS DISTINCT FROM disp.id
       OR autorizacao.snapshot->>'reservaId' IS DISTINCT FROM reserva.id
       OR autorizacao.snapshot->>'itemReservaId' IS DISTINCT FROM NEW."itemReservaId"
       OR autorizacao.snapshot->>'habilidade' IS DISTINCT FROM (
         SELECT habilidade FROM "ItemReservaTentativaRecuperacao" WHERE id = NEW."itemReservaId"
       ) THEN
      RAISE EXCEPTION 'Snapshot da autorização especial não corresponde à fonte atual';
    END IF;
  END IF;

  registrador := COALESCE(NEW."registradaPorId", NEW."professorId");
  PERFORM id FROM "Usuario" WHERE id = registrador AND ativo AND 'PROFESSOR'::"Papel" = ANY(papeis) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Realização exige professor ativo'; END IF;
  SELECT * INTO a FROM "AlocacaoTurma" WHERE id = p."alocacaoId";
  IF NEW."realizadaEm" < a."criadoEm" OR a."matriculaId" IS DISTINCT FROM p."matriculaId" THEN RAISE EXCEPTION 'Vínculo de origem inválido'; END IF;
  IF (a."encerradaEm" IS NOT NULL AND NEW."realizadaEm" >= a."encerradaEm") OR (NOT a.ativa AND a."encerradaEm" IS NULL) THEN
    IF NEW."autorizacaoEspecialId" IS NULL THEN RAISE EXCEPTION 'Realização fora do vínculo do aluno'; END IF;
  END IF;
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
