-- Q151: autorização excepcional registra somente uma permissão auditável; ela
-- não cria realização nem altera os fatos de recuperação já existentes.
CREATE TABLE "AutorizacaoEspecialRecuperacao" (
  "id" TEXT NOT NULL,
  "itemReservaId" TEXT NOT NULL,
  "autorizadorId" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "prazoAte" TIMESTAMP(3) NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),
  "chaveIdempotencia" TEXT NOT NULL,
  "entradaHash" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,

  CONSTRAINT "AutorizacaoEspecialRecuperacao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AutorizacaoEspecialRecuperacao_motivo_tamanho_check" CHECK (length(btrim("motivo")) BETWEEN 5 AND 2000),
  CONSTRAINT "AutorizacaoEspecialRecuperacao_entradaHash_formato_check" CHECK ("entradaHash" ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX "AutorizacaoEspecialRecuperacao_autorizadorId_chaveIdempotencia_key"
  ON "AutorizacaoEspecialRecuperacao" ("autorizadorId", "chaveIdempotencia");
CREATE INDEX "AutorizacaoEspecialRecuperacao_itemReservaId_criadaEm_idx"
  ON "AutorizacaoEspecialRecuperacao" ("itemReservaId", "criadaEm");

ALTER TABLE "AutorizacaoEspecialRecuperacao"
  ADD CONSTRAINT "AutorizacaoEspecialRecuperacao_itemReservaId_fkey"
  FOREIGN KEY ("itemReservaId") REFERENCES "ItemReservaTentativaRecuperacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "AutorizacaoEspecialRecuperacao"
  ADD CONSTRAINT "AutorizacaoEspecialRecuperacao_autorizadorId_fkey"
  FOREIGN KEY ("autorizadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION guardar_autorizacao_especial_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  item "ItemReservaTentativaRecuperacao"%ROWTYPE;
  reserva "ReservaTentativaRecuperacao"%ROWTYPE;
  plano "PropostaPlanoRecuperacao"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Autorização especial de recuperação é imutável';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));

  -- A data de criação é sempre a do banco nesta instrução, nunca uma data
  -- retroativa informada pelo cliente.
  NEW."criadaEm" := statement_timestamp() AT TIME ZONE 'UTC';
  IF length(btrim(NEW.motivo)) NOT BETWEEN 5 AND 2000
     OR NEW."entradaHash" !~ '^[a-f0-9]{64}$'
     OR length(btrim(NEW."chaveIdempotencia")) NOT BETWEEN 8 AND 100 THEN
    RAISE EXCEPTION 'Dados da autorização especial de recuperação inválidos';
  END IF;
  IF NEW."prazoAte" <= NEW."criadaEm" THEN
    RAISE EXCEPTION 'Prazo da autorização especial deve ser futuro';
  END IF;

  SELECT * INTO item FROM "ItemReservaTentativaRecuperacao"
    WHERE id = NEW."itemReservaId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item de reserva de recuperação não encontrado'; END IF;
  SELECT * INTO reserva FROM "ReservaTentativaRecuperacao"
    WHERE id = item."reservaId" FOR SHARE;
  SELECT * INTO plano FROM "PropostaPlanoRecuperacao"
    WHERE id = reserva."propostaId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plano de recuperação não encontrado'; END IF;

  PERFORM id FROM "Usuario"
    WHERE id = NEW."autorizadorId" AND ativo
      AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]
    FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Autorização especial exige gestor ativo'; END IF;
  PERFORM id FROM "Matricula"
    WHERE id = plano."matriculaId" AND status IN ('PAUSADA','ENCERRADA')
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Autorização especial exige matrícula pausada ou encerrada'; END IF;
  PERFORM id FROM "DecisaoPlanoRecuperacao"
    WHERE "propostaId" = plano.id AND aprovada FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Autorização especial exige plano aprovado'; END IF;
  PERFORM id FROM "DisponibilizacaoPlanoRecuperacao"
    WHERE "propostaId" = plano.id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Autorização especial exige plano disponibilizado'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "AlocacaoTurma" a
      JOIN "Turma" t ON t.id = a."turmaId"
      WHERE a.id = plano."alocacaoId"
        AND a."matriculaId" = plano."matriculaId"
        AND t."nivelId" = plano."nivelId" AND t."regraAvaliacaoId" = plano."regraId"
  ) THEN
    RAISE EXCEPTION 'Vínculo do plano de recuperação mudou';
  END IF;
  IF EXISTS (SELECT 1 FROM "RealizacaoRecuperacao" WHERE "itemReservaId" = item.id) THEN
    RAISE EXCEPTION 'Item com realização não recebe autorização especial';
  END IF;
  IF EXISTS (SELECT 1 FROM "CancelamentoReservaRecuperacao" WHERE "reservaId" = reserva.id) THEN
    RAISE EXCEPTION 'Reserva cancelada não recebe autorização especial';
  END IF;
  IF NEW.snapshot IS DISTINCT FROM jsonb_build_object(
    'matriculaId', plano."matriculaId", 'alocacaoId', plano."alocacaoId", 'regraId', plano."regraId",
    'propostaId', plano.id, 'propostaHash', plano."entradaHash",
    'decisaoId', (SELECT id FROM "DecisaoPlanoRecuperacao" WHERE "propostaId" = plano.id),
    'disponibilizacaoId', (SELECT id FROM "DisponibilizacaoPlanoRecuperacao" WHERE "propostaId" = plano.id),
    'reservaId', reserva.id, 'itemReservaId', item.id, 'habilidade', item.habilidade,
    'statusMatricula', (SELECT status::text FROM "Matricula" WHERE id = plano."matriculaId")
  ) THEN RAISE EXCEPTION 'Fonte da autorização de recuperação diverge da pendência'; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guardar_autorizacao_especial_recuperacao
BEFORE INSERT OR UPDATE OR DELETE ON "AutorizacaoEspecialRecuperacao"
FOR EACH ROW EXECUTE FUNCTION guardar_autorizacao_especial_recuperacao();
