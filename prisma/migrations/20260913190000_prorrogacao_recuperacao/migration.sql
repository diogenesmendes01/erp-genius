-- CreateTable
CREATE TABLE "PropostaProrrogacaoRecuperacao" (
    "id" TEXT NOT NULL,
    "disponibilizacaoId" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "prazoAnterior" TIMESTAMP(3) NOT NULL,
    "novoPrazo" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaProrrogacaoRecuperacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoProrrogacaoRecuperacao" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoProrrogacaoRecuperacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropostaProrrogacaoRecuperacao_disponibilizacaoId_versao_key" ON "PropostaProrrogacaoRecuperacao"("disponibilizacaoId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaProrrogacaoRecuperacao_preparadorId_chaveIdempotenc_key" ON "PropostaProrrogacaoRecuperacao"("preparadorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoProrrogacaoRecuperacao_propostaId_key" ON "DecisaoProrrogacaoRecuperacao"("propostaId");

-- AddForeignKey
ALTER TABLE "PropostaProrrogacaoRecuperacao" ADD CONSTRAINT "PropostaProrrogacaoRecuperacao_disponibilizacaoId_fkey" FOREIGN KEY ("disponibilizacaoId") REFERENCES "DisponibilizacaoPlanoRecuperacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaProrrogacaoRecuperacao" ADD CONSTRAINT "PropostaProrrogacaoRecuperacao_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoProrrogacaoRecuperacao" ADD CONSTRAINT "DecisaoProrrogacaoRecuperacao_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaProrrogacaoRecuperacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoProrrogacaoRecuperacao" ADD CONSTRAINT "DecisaoProrrogacaoRecuperacao_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;


CREATE FUNCTION prazo_recuperacao_vigente(disponibilizacao_id TEXT) RETURNS TIMESTAMP LANGUAGE sql STABLE AS $$
 SELECT COALESCE((SELECT p."novoPrazo" FROM "PropostaProrrogacaoRecuperacao" p JOIN "DecisaoProrrogacaoRecuperacao" d ON d."propostaId" = p.id AND d.aprovada WHERE p."disponibilizacaoId" = disponibilizacao_id ORDER BY p.versao DESC LIMIT 1), (SELECT "prazoAte" FROM "DisponibilizacaoPlanoRecuperacao" WHERE id = disponibilizacao_id));
$$;

CREATE FUNCTION preservar_proposta_prorrogacao_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE plano "PropostaPlanoRecuperacao"%ROWTYPE; papeis_autor "Papel"[];
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Prorrogação é imutável'; END IF;
 SELECT p.* INTO plano FROM "DisponibilizacaoPlanoRecuperacao" d JOIN "PropostaPlanoRecuperacao" p ON p.id = d."propostaId" WHERE d.id = NEW."disponibilizacaoId";
 PERFORM id FROM "Matricula" WHERE id = plano."matriculaId" AND status = 'ATIVA' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Prorrogação exige matrícula ativa'; END IF;
 SELECT papeis INTO papeis_autor FROM "Usuario" WHERE id = NEW."preparadorId" AND ativo FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Preparador inativo'; END IF;
 IF NOT (papeis_autor && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]) THEN
  IF NOT ('PROFESSOR'::"Papel" = ANY(papeis_autor)) OR NOT EXISTS (SELECT 1 FROM "AlocacaoTurma" a JOIN "Turma" t ON t.id = a."turmaId" JOIN "VinculoDocente" v ON v."turmaId" = t.id WHERE a.id = plano."alocacaoId" AND t."professorId" = NEW."preparadorId" AND t.status <> 'CONCLUIDA' AND v."professorId" = NEW."preparadorId" AND v.fim IS NULL AND v.inicio <= (clock_timestamp() AT TIME ZONE 'UTC')) THEN RAISE EXCEPTION 'Sem atribuição para prorrogar'; END IF;
 END IF;
 IF NEW.versao <> COALESCE((SELECT MAX(versao) FROM "PropostaProrrogacaoRecuperacao" WHERE "disponibilizacaoId" = NEW."disponibilizacaoId"),0) + 1 THEN RAISE EXCEPTION 'Versão de prorrogação desatualizada'; END IF;
 IF NEW."prazoAnterior" IS DISTINCT FROM prazo_recuperacao_vigente(NEW."disponibilizacaoId") OR NEW."novoPrazo" <= NEW."prazoAnterior" OR NEW."novoPrazo" <= (clock_timestamp() AT TIME ZONE 'UTC') THEN RAISE EXCEPTION 'Prazo da prorrogação inválido'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_proposta_prorrogacao_recuperacao BEFORE INSERT OR UPDATE OR DELETE ON "PropostaProrrogacaoRecuperacao" FOR EACH ROW EXECUTE FUNCTION preservar_proposta_prorrogacao_recuperacao();

CREATE FUNCTION preservar_decisao_prorrogacao_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaProrrogacaoRecuperacao"%ROWTYPE; matricula_id TEXT;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisão de prorrogação é imutável'; END IF;
 SELECT * INTO p FROM "PropostaProrrogacaoRecuperacao" WHERE id = NEW."propostaId";
 SELECT plano."matriculaId" INTO matricula_id FROM "DisponibilizacaoPlanoRecuperacao" d JOIN "PropostaPlanoRecuperacao" plano ON plano.id = d."propostaId" WHERE d.id = p."disponibilizacaoId";
 PERFORM id FROM "Matricula" WHERE id = matricula_id FOR UPDATE;
 PERFORM id FROM "Usuario" WHERE id = NEW."decisorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND OR p."preparadorId" = NEW."decisorId" THEN RAISE EXCEPTION 'Outra pessoa da gestão precisa decidir'; END IF;
 IF NEW.aprovada THEN
  IF NOT EXISTS (SELECT 1 FROM "Matricula" WHERE id = matricula_id AND status = 'ATIVA') THEN RAISE EXCEPTION 'Confira autorização específica da matrícula'; END IF;
  IF p.versao <> (SELECT MAX(versao) FROM "PropostaProrrogacaoRecuperacao" WHERE "disponibilizacaoId" = p."disponibilizacaoId") THEN RAISE EXCEPTION 'Existe prorrogação mais recente'; END IF;
  IF p."prazoAnterior" IS DISTINCT FROM prazo_recuperacao_vigente(p."disponibilizacaoId") OR p."novoPrazo" <= p."prazoAnterior" OR p."novoPrazo" <= (clock_timestamp() AT TIME ZONE 'UTC') THEN RAISE EXCEPTION 'Prazo da prorrogação mudou ou venceu'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_decisao_prorrogacao_recuperacao BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoProrrogacaoRecuperacao" FOR EACH ROW EXECUTE FUNCTION preservar_decisao_prorrogacao_recuperacao();

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
  SELECT count(*) INTO ocupadas FROM "ItemReservaTentativaRecuperacao" i JOIN "ReservaTentativaRecuperacao" r ON r.id = i."reservaId" JOIN "PropostaPlanoRecuperacao" plano ON plano.id = r."propostaId" WHERE plano."matriculaId" = p."matriculaId" AND plano."nivelId" = p."nivelId" AND i.habilidade = NEW.habilidade AND NOT EXISTS (SELECT 1 FROM "CancelamentoReservaRecuperacao" c WHERE c."reservaId" = r.id);
  IF limite IS NULL OR ocupadas >= limite THEN RAISE EXCEPTION 'Limite de tentativas da habilidade esgotado'; END IF;
 END IF;
 RETURN NEW;
END;
$$;


