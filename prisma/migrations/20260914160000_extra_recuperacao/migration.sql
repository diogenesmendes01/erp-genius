-- CreateTable
CREATE TABLE "PropostaExtraRecuperacao" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "alocacaoId" TEXT NOT NULL,
    "nivelId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "habilidade" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "evidencias" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "estadoHash" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaExtraRecuperacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoExtraRecuperacao" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoExtraRecuperacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropostaExtraRecuperacao_matriculaId_nivelId_habilidade_idx" ON "PropostaExtraRecuperacao"("matriculaId", "nivelId", "habilidade");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaExtraRecuperacao_autorId_chaveIdempotencia_key" ON "PropostaExtraRecuperacao"("autorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoExtraRecuperacao_propostaId_key" ON "DecisaoExtraRecuperacao"("propostaId");

-- AddForeignKey
ALTER TABLE "PropostaExtraRecuperacao" ADD CONSTRAINT "PropostaExtraRecuperacao_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaExtraRecuperacao" ADD CONSTRAINT "PropostaExtraRecuperacao_alocacaoId_fkey" FOREIGN KEY ("alocacaoId") REFERENCES "AlocacaoTurma"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaExtraRecuperacao" ADD CONSTRAINT "PropostaExtraRecuperacao_nivelId_fkey" FOREIGN KEY ("nivelId") REFERENCES "Nivel"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaExtraRecuperacao" ADD CONSTRAINT "PropostaExtraRecuperacao_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoExtraRecuperacao" ADD CONSTRAINT "DecisaoExtraRecuperacao_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaExtraRecuperacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoExtraRecuperacao" ADD CONSTRAINT "DecisaoExtraRecuperacao_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "PropostaExtraRecuperacao" ADD CONSTRAINT extra_recuperacao_conteudo CHECK (
 quantidade > 0 AND habilidade IN ('FALA','COMPREENSAO_ORAL','LEITURA','ESCRITA') AND length(trim(motivo)) >= 5 AND length(trim(evidencias)) >= 5);
CREATE FUNCTION estado_extra_recuperacao(alocacao_id TEXT, habilidade_alvo TEXT) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE a "AlocacaoTurma"%ROWTYPE; t "Turma"%ROWTYPE; situacao TEXT; limite BIGINT; extras BIGINT; ocupadas BIGINT;
BEGIN
 SELECT * INTO a FROM "AlocacaoTurma" WHERE id = alocacao_id;
 SELECT * INTO t FROM "Turma" WHERE id = a."turmaId";
 SELECT status::text INTO situacao FROM "Matricula" WHERE id = a."matriculaId";
 SELECT (h->>'limiteRecuperacoes')::bigint INTO limite FROM "VersaoRegraAvaliacao" r, jsonb_array_elements(r.conteudo->'habilidades') h WHERE r.id = t."regraAvaliacaoId" AND h->>'habilidade' = habilidade_alvo;
 IF a."matriculaId" IS NULL OR limite IS NULL THEN RAISE EXCEPTION 'Confira vínculo e regra da recuperação'; END IF;
 SELECT coalesce(sum(p.quantidade),0) INTO extras FROM "PropostaExtraRecuperacao" p JOIN "DecisaoExtraRecuperacao" d ON d."propostaId" = p.id AND d.aprovada WHERE p."matriculaId" = a."matriculaId" AND p."nivelId" = t."nivelId" AND p.habilidade = habilidade_alvo;
 SELECT count(*) INTO ocupadas FROM "ItemReservaTentativaRecuperacao" i JOIN "ReservaTentativaRecuperacao" r ON r.id = i."reservaId" JOIN "PropostaPlanoRecuperacao" p ON p.id = r."propostaId" WHERE p."matriculaId" = a."matriculaId" AND p."nivelId" = t."nivelId" AND i.habilidade = habilidade_alvo AND (NOT EXISTS (SELECT 1 FROM "CancelamentoReservaRecuperacao" c WHERE c."reservaId" = r.id) OR EXISTS (SELECT 1 FROM "RealizacaoRecuperacao" x WHERE x."itemReservaId" = i.id));
 RETURN jsonb_build_object('alocacaoId',a.id,'matriculaId',a."matriculaId",'nivelId',t."nivelId",'regraId',t."regraAvaliacaoId",'ativa',a.ativa,'statusMatricula',situacao,'habilidade',habilidade_alvo,'limiteBase',limite,'extrasAprovados',extras,'ocupadas',ocupadas);
END $$;
CREATE FUNCTION preservar_extra_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaExtraRecuperacao"%ROWTYPE; atual jsonb;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Proposta e decisão de oportunidade extra são imutáveis'; END IF;
 IF TG_TABLE_NAME = 'PropostaExtraRecuperacao' THEN
  PERFORM id FROM "Matricula" WHERE id = NEW."matriculaId" FOR UPDATE;
  atual := estado_extra_recuperacao(NEW."alocacaoId",NEW.habilidade);
  IF atual->>'matriculaId' <> NEW."matriculaId" OR atual->>'nivelId' <> NEW."nivelId" OR atual <> NEW.snapshot THEN RAISE EXCEPTION 'Contexto da oportunidade extra divergente'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u.id = NEW."autorId" AND u.ativo AND (u.papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] OR ('PROFESSOR' = ANY(u.papeis) AND EXISTS (SELECT 1 FROM "AlocacaoTurma" a JOIN "VinculoDocente" v ON v."turmaId" = a."turmaId" WHERE a.id = NEW."alocacaoId" AND v."professorId" = u.id AND v.fim IS NULL)))) THEN RAISE EXCEPTION 'Autor sem atribuição para oportunidade extra'; END IF;
 ELSE
  SELECT * INTO p FROM "PropostaExtraRecuperacao" WHERE id = NEW."propostaId";
  PERFORM id FROM "Matricula" WHERE id = p."matriculaId" FOR UPDATE;
  IF p."autorId" = NEW."decisorId" THEN RAISE EXCEPTION 'Outra pessoa deve decidir a oportunidade extra'; END IF;
  IF length(trim(NEW.motivo)) < 5 OR NOT EXISTS (SELECT 1 FROM "Usuario" WHERE id = NEW."decisorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Decisão exige gestão ativa e motivo'; END IF;
  IF NOT NEW.aprovada THEN RETURN NEW; END IF;
  atual := estado_extra_recuperacao(p."alocacaoId",p.habilidade);
  IF atual <> p.snapshot THEN RAISE EXCEPTION 'O saldo ou vínculo mudou; confira nova proposta'; END IF;
 END IF;
 IF atual->>'statusMatricula' <> 'ATIVA' OR NOT (atual->>'ativa')::boolean THEN RAISE EXCEPTION 'Oportunidade extra exige vínculo ativo conferido'; END IF;
 IF (atual->>'ocupadas')::bigint < (atual->>'limiteBase')::bigint + (atual->>'extrasAprovados')::bigint THEN RAISE EXCEPTION 'Ainda há oportunidades disponíveis'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER preservar_extra_recuperacao BEFORE INSERT OR UPDATE OR DELETE ON "PropostaExtraRecuperacao" FOR EACH ROW EXECUTE FUNCTION preservar_extra_recuperacao();
CREATE TRIGGER preservar_decisao_extra_recuperacao BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoExtraRecuperacao" FOR EACH ROW EXECUTE FUNCTION preservar_extra_recuperacao();
CREATE OR REPLACE FUNCTION preservar_reserva_tentativa_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaPlanoRecuperacao"%ROWTYPE; limite BIGINT; ocupadas BIGINT;
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
  limite := limite + (SELECT coalesce(sum(extra.quantidade),0) FROM "PropostaExtraRecuperacao" extra JOIN "DecisaoExtraRecuperacao" decisao ON decisao."propostaId" = extra.id AND decisao.aprovada WHERE extra."matriculaId" = p."matriculaId" AND extra."nivelId" = p."nivelId" AND extra.habilidade = NEW.habilidade);
  IF limite IS NULL OR ocupadas >= limite THEN RAISE EXCEPTION 'Limite de tentativas da habilidade esgotado'; END IF;
 END IF;
 RETURN NEW;
END;
$$;



