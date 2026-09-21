-- CreateTable
CREATE TABLE "RealizacaoRecuperacao" (
    "id" TEXT NOT NULL,
    "itemReservaId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "realizadaEm" TIMESTAMP(3) NOT NULL,
    "evidencia" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RealizacaoRecuperacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RealizacaoRecuperacao_itemReservaId_key" ON "RealizacaoRecuperacao"("itemReservaId");

-- AddForeignKey
ALTER TABLE "RealizacaoRecuperacao" ADD CONSTRAINT "RealizacaoRecuperacao_itemReservaId_fkey" FOREIGN KEY ("itemReservaId") REFERENCES "ItemReservaTentativaRecuperacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RealizacaoRecuperacao" ADD CONSTRAINT "RealizacaoRecuperacao_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

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
  IF NOT EXISTS (SELECT 1 FROM "DisponibilizacaoPlanoRecuperacao" WHERE "propostaId" = p.id AND "disponibilizadaEm" <= (clock_timestamp() AT TIME ZONE 'UTC') AND prazo_recuperacao_vigente("DisponibilizacaoPlanoRecuperacao".id) > (clock_timestamp() AT TIME ZONE 'UTC')) THEN RAISE EXCEPTION 'Plano sem disponibilização no prazo'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "AlocacaoTurma" a JOIN "Turma" t ON t.id = a."turmaId" WHERE a.id = p."alocacaoId" AND a.ativa AND a."matriculaId" = p."matriculaId" AND t."nivelId" = p."nivelId" AND t."regraAvaliacaoId" = p."regraId") THEN RAISE EXCEPTION 'Vínculo do plano mudou'; END IF;
 ELSE
  SELECT plano.* INTO p FROM "ReservaTentativaRecuperacao" r JOIN "PropostaPlanoRecuperacao" plano ON plano.id = r."propostaId" WHERE r.id = NEW."reservaId";
  PERFORM id FROM "Matricula" WHERE id = p."matriculaId" FOR UPDATE;
  IF EXISTS (SELECT 1 FROM "CancelamentoReservaRecuperacao" WHERE "reservaId" = NEW."reservaId") THEN RAISE EXCEPTION 'Reserva cancelada não recebe novos itens'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p.atividades) a WHERE a->>'habilidade' = NEW.habilidade) THEN RAISE EXCEPTION 'Habilidade fora do plano'; END IF;
  SELECT (h->>'limiteRecuperacoes')::integer INTO limite FROM "VersaoRegraAvaliacao" regra, jsonb_array_elements(regra.conteudo->'habilidades') h WHERE regra.id = p."regraId" AND h->>'habilidade' = NEW.habilidade;
  SELECT count(*) INTO ocupadas FROM "ItemReservaTentativaRecuperacao" i JOIN "ReservaTentativaRecuperacao" r ON r.id = i."reservaId" JOIN "PropostaPlanoRecuperacao" plano ON plano.id = r."propostaId" WHERE plano."matriculaId" = p."matriculaId" AND plano."nivelId" = p."nivelId" AND i.habilidade = NEW.habilidade AND (NOT EXISTS (SELECT 1 FROM "CancelamentoReservaRecuperacao" c WHERE c."reservaId" = r.id) OR EXISTS (SELECT 1 FROM "RealizacaoRecuperacao" realizada WHERE realizada."itemReservaId" = i.id));
  IF limite IS NULL OR ocupadas >= limite THEN RAISE EXCEPTION 'Limite de tentativas da habilidade esgotado'; END IF;
 END IF;
 RETURN NEW;
END;
$$;



CREATE OR REPLACE FUNCTION preservar_cancelamento_reserva_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE matricula_id TEXT;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Cancelamento de reserva é imutável'; END IF;
 SELECT p."matriculaId" INTO matricula_id FROM "ReservaTentativaRecuperacao" r JOIN "PropostaPlanoRecuperacao" p ON p.id = r."propostaId" WHERE r.id = NEW."reservaId";
 PERFORM id FROM "Matricula" WHERE id = matricula_id FOR UPDATE;
 PERFORM id FROM "Usuario" WHERE id = NEW."autorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cancelamento exige gestão ativa'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "ItemReservaTentativaRecuperacao" i WHERE i."reservaId" = NEW."reservaId" AND NOT EXISTS (SELECT 1 FROM "RealizacaoRecuperacao" realizada WHERE realizada."itemReservaId" = i.id)) THEN RAISE EXCEPTION 'Reserva sem habilidades'; END IF;
 IF COALESCE(length(btrim(NEW.motivo)),0) < 5 OR length(NEW.motivo) > 2000 OR COALESCE(length(btrim(NEW.evidencia)),0) < 5 OR length(NEW.evidencia) > 4000 THEN RAISE EXCEPTION 'Justifique e registre evidência do cancelamento pela escola'; END IF;
 RETURN NEW;
END;
$$;


CREATE FUNCTION prazo_recuperacao_na_data(disponibilizacao_id TEXT, instante TIMESTAMP) RETURNS TIMESTAMP LANGUAGE sql STABLE AS $$
 SELECT COALESCE((SELECT p."novoPrazo" FROM "PropostaProrrogacaoRecuperacao" p JOIN "DecisaoProrrogacaoRecuperacao" d ON d."propostaId" = p.id AND d.aprovada AND d."criadaEm" <= instante WHERE p."disponibilizacaoId" = disponibilizacao_id ORDER BY p.versao DESC LIMIT 1), (SELECT "prazoAte" FROM "DisponibilizacaoPlanoRecuperacao" WHERE id = disponibilizacao_id));
$$;
CREATE FUNCTION preservar_realizacao_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaPlanoRecuperacao"%ROWTYPE; reserva "ReservaTentativaRecuperacao"%ROWTYPE; disp "DisponibilizacaoPlanoRecuperacao"%ROWTYPE; a "AlocacaoTurma"%ROWTYPE;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Realização de recuperação é imutável'; END IF;
 SELECT r.* INTO reserva FROM "ItemReservaTentativaRecuperacao" i JOIN "ReservaTentativaRecuperacao" r ON r.id = i."reservaId" WHERE i.id = NEW."itemReservaId";
 SELECT * INTO p FROM "PropostaPlanoRecuperacao" WHERE id = reserva."propostaId";
 PERFORM id FROM "Matricula" WHERE id = p."matriculaId" FOR UPDATE;
 IF EXISTS (SELECT 1 FROM "CancelamentoReservaRecuperacao" WHERE "reservaId" = reserva.id) THEN RAISE EXCEPTION 'Tentativa cancelada'; END IF;
 SELECT * INTO disp FROM "DisponibilizacaoPlanoRecuperacao" WHERE "propostaId" = p.id;
 IF disp.id IS NULL OR NEW."realizadaEm" < reserva."criadaEm" OR NEW."realizadaEm" < disp."disponibilizadaEm" OR NEW."realizadaEm" >= prazo_recuperacao_na_data(disp.id, NEW."realizadaEm") OR NEW."realizadaEm" > (clock_timestamp() AT TIME ZONE 'UTC') THEN RAISE EXCEPTION 'Realização fora do período autorizado'; END IF;
 PERFORM id FROM "Usuario" WHERE id = NEW."professorId" AND ativo AND 'PROFESSOR'::"Papel" = ANY(papeis) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Realização exige professor ativo'; END IF;
 SELECT * INTO a FROM "AlocacaoTurma" WHERE id = p."alocacaoId";
 IF NEW."realizadaEm" < a."criadoEm" OR (a."encerradaEm" IS NOT NULL AND NEW."realizadaEm" >= a."encerradaEm") OR (NOT a.ativa AND a."encerradaEm" IS NULL) THEN RAISE EXCEPTION 'Realização fora do vínculo do aluno'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "Turma" t JOIN "VinculoDocente" v ON v."turmaId" = t.id WHERE t.id = a."turmaId" AND t."professorId" = NEW."professorId" AND t.status <> 'CONCLUIDA' AND v."professorId" = NEW."professorId" AND v.fim IS NULL AND v.inicio <= NEW."realizadaEm") THEN RAISE EXCEPTION 'Professor sem atribuição para recuperação'; END IF;
 IF COALESCE(length(btrim(NEW.evidencia)),0) < 5 OR length(NEW.evidencia) > 4000 THEN RAISE EXCEPTION 'Registre evidência da realização'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_realizacao_recuperacao BEFORE INSERT OR UPDATE OR DELETE ON "RealizacaoRecuperacao" FOR EACH ROW EXECUTE FUNCTION preservar_realizacao_recuperacao();
