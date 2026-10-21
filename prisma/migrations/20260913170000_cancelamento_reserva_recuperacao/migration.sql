-- CreateTable
CREATE TABLE "CancelamentoReservaRecuperacao" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "evidencia" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CancelamentoReservaRecuperacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CancelamentoReservaRecuperacao_reservaId_key" ON "CancelamentoReservaRecuperacao"("reservaId");

-- AddForeignKey
ALTER TABLE "CancelamentoReservaRecuperacao" ADD CONSTRAINT "CancelamentoReservaRecuperacao_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "ReservaTentativaRecuperacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CancelamentoReservaRecuperacao" ADD CONSTRAINT "CancelamentoReservaRecuperacao_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE OR REPLACE FUNCTION preservar_reserva_tentativa_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaPlanoRecuperacao"%ROWTYPE; limite INTEGER; ocupadas BIGINT;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Reserva de tentativa é imutável'; END IF;
 IF TG_TABLE_NAME = 'ReservaTentativaRecuperacao' THEN
  SELECT * INTO p FROM "PropostaPlanoRecuperacao" WHERE id = NEW."propostaId";
  PERFORM id FROM "Matricula" WHERE id = p."matriculaId" AND status = 'ATIVA' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva exige matrícula ativa'; END IF;
  PERFORM id FROM "Usuario" WHERE id = NEW."autorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva exige gestão ativa'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "DecisaoPlanoRecuperacao" WHERE "propostaId" = p.id AND aprovada) THEN RAISE EXCEPTION 'Plano não aprovado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "AlocacaoTurma" a JOIN "Turma" t ON t.id = a."turmaId" WHERE a.id = p."alocacaoId" AND a.ativa AND a."matriculaId" = p."matriculaId" AND t."nivelId" = p."nivelId" AND t."regraAvaliacaoId" = p."regraId") THEN RAISE EXCEPTION 'Vínculo do plano mudou'; END IF;
 ELSE
  SELECT plano.* INTO p FROM "ReservaTentativaRecuperacao" r JOIN "PropostaPlanoRecuperacao" plano ON plano.id = r."propostaId" WHERE r.id = NEW."reservaId";
  PERFORM id FROM "Matricula" WHERE id = p."matriculaId" FOR UPDATE;
  IF EXISTS (SELECT 1 FROM "CancelamentoReservaRecuperacao" WHERE "reservaId" = NEW."reservaId") THEN RAISE EXCEPTION 'Reserva cancelada não recebe novos itens'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p.atividades) a WHERE a->>'habilidade' = NEW.habilidade) THEN RAISE EXCEPTION 'Habilidade fora do plano'; END IF;
  SELECT (h->>'limiteRecuperacoes')::integer INTO limite FROM "VersaoRegraAvaliacao" regra, jsonb_array_elements(regra.conteudo->'habilidades') h WHERE regra.id = p."regraId" AND h->>'habilidade' = NEW.habilidade;
  SELECT count(*) INTO ocupadas FROM "ItemReservaTentativaRecuperacao" i JOIN "ReservaTentativaRecuperacao" r ON r.id = i."reservaId" JOIN "PropostaPlanoRecuperacao" plano ON plano.id = r."propostaId" WHERE plano."matriculaId" = p."matriculaId" AND plano."nivelId" = p."nivelId" AND i.habilidade = NEW.habilidade AND NOT EXISTS (SELECT 1 FROM "CancelamentoReservaRecuperacao" c WHERE c."reservaId" = r.id);
  IF limite IS NULL OR ocupadas >= limite THEN RAISE EXCEPTION 'Limite de tentativas da habilidade esgotado'; END IF;
 END IF;
 RETURN NEW;
END;
$$;

CREATE FUNCTION preservar_cancelamento_reserva_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE matricula_id TEXT;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Cancelamento de reserva é imutável'; END IF;
 SELECT p."matriculaId" INTO matricula_id FROM "ReservaTentativaRecuperacao" r JOIN "PropostaPlanoRecuperacao" p ON p.id = r."propostaId" WHERE r.id = NEW."reservaId";
 PERFORM id FROM "Matricula" WHERE id = matricula_id FOR UPDATE;
 PERFORM id FROM "Usuario" WHERE id = NEW."autorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cancelamento exige gestão ativa'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "ItemReservaTentativaRecuperacao" WHERE "reservaId" = NEW."reservaId") THEN RAISE EXCEPTION 'Reserva sem habilidades'; END IF;
 IF COALESCE(length(btrim(NEW.motivo)),0) < 5 OR length(NEW.motivo) > 2000 OR COALESCE(length(btrim(NEW.evidencia)),0) < 5 OR length(NEW.evidencia) > 4000 THEN RAISE EXCEPTION 'Justifique e registre evidência do cancelamento pela escola'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_cancelamento_reserva_recuperacao BEFORE INSERT OR UPDATE OR DELETE ON "CancelamentoReservaRecuperacao" FOR EACH ROW EXECUTE FUNCTION preservar_cancelamento_reserva_recuperacao();
