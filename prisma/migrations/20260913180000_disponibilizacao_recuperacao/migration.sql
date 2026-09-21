-- CreateTable
CREATE TABLE "DisponibilizacaoPlanoRecuperacao" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "disponibilizadaEm" TIMESTAMP(3) NOT NULL,
    "prazoMinutos" INTEGER NOT NULL,
    "prazoAte" TIMESTAMP(3) NOT NULL,
    "condicoes" TEXT NOT NULL,
    "evidenciaComunicacao" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisponibilizacaoPlanoRecuperacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DisponibilizacaoPlanoRecuperacao_propostaId_key" ON "DisponibilizacaoPlanoRecuperacao"("propostaId");

-- AddForeignKey
ALTER TABLE "DisponibilizacaoPlanoRecuperacao" ADD CONSTRAINT "DisponibilizacaoPlanoRecuperacao_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaPlanoRecuperacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DisponibilizacaoPlanoRecuperacao" ADD CONSTRAINT "DisponibilizacaoPlanoRecuperacao_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

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
  IF NOT EXISTS (SELECT 1 FROM "DisponibilizacaoPlanoRecuperacao" WHERE "propostaId" = p.id AND "disponibilizadaEm" <= (clock_timestamp() AT TIME ZONE 'UTC') AND "prazoAte" > (clock_timestamp() AT TIME ZONE 'UTC')) THEN RAISE EXCEPTION 'Plano sem disponibilização no prazo'; END IF;
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


CREATE FUNCTION preservar_disponibilizacao_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaPlanoRecuperacao"%ROWTYPE; aprovada_em TIMESTAMP; prazo INTEGER;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Disponibilização de recuperação é imutável'; END IF;
 SELECT * INTO p FROM "PropostaPlanoRecuperacao" WHERE id = NEW."propostaId";
 PERFORM id FROM "Matricula" WHERE id = p."matriculaId" AND status = 'ATIVA' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Disponibilização exige matrícula ativa'; END IF;
 PERFORM id FROM "Usuario" WHERE id = NEW."autorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Disponibilização exige gestão ativa'; END IF;
 SELECT "criadaEm" INTO aprovada_em FROM "DecisaoPlanoRecuperacao" WHERE "propostaId" = p.id AND aprovada;
 IF aprovada_em IS NULL OR NEW."disponibilizadaEm" < aprovada_em OR NEW."disponibilizadaEm" > (clock_timestamp() AT TIME ZONE 'UTC') THEN RAISE EXCEPTION 'Disponibilização exige aprovação e data válida'; END IF;
 SELECT (conteudo->'recuperacao'->>'prazoRealizacaoMinutos')::integer INTO prazo FROM "VersaoRegraAvaliacao" WHERE id = p."regraId";
 IF prazo IS NULL OR NEW."prazoMinutos" <> prazo OR NEW."prazoAte" <> NEW."disponibilizadaEm" + prazo * interval '1 minute' THEN RAISE EXCEPTION 'Prazo incompatível com a regra aprovada'; END IF;
 IF COALESCE(length(btrim(NEW.condicoes)),0) < 5 OR length(NEW.condicoes) > 4000 OR COALESCE(length(btrim(NEW."evidenciaComunicacao")),0) < 5 OR length(NEW."evidenciaComunicacao") > 4000 THEN RAISE EXCEPTION 'Registre condições e evidência de comunicação ao aluno'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_disponibilizacao_recuperacao BEFORE INSERT OR UPDATE OR DELETE ON "DisponibilizacaoPlanoRecuperacao" FOR EACH ROW EXECUTE FUNCTION preservar_disponibilizacao_recuperacao();
