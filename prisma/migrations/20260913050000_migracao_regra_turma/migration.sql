-- CreateTable
CREATE TABLE "PropostaMigracaoRegraTurma" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "origemId" TEXT,
    "destinoId" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "estadoHash" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaMigracaoRegraTurma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoMigracaoRegraTurma" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoMigracaoRegraTurma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropostaMigracaoRegraTurma_turmaId_versao_key" ON "PropostaMigracaoRegraTurma"("turmaId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaMigracaoRegraTurma_preparadorId_chaveIdempotencia_key" ON "PropostaMigracaoRegraTurma"("preparadorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoMigracaoRegraTurma_propostaId_key" ON "DecisaoMigracaoRegraTurma"("propostaId");

-- AddForeignKey
ALTER TABLE "PropostaMigracaoRegraTurma" ADD CONSTRAINT "PropostaMigracaoRegraTurma_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaMigracaoRegraTurma" ADD CONSTRAINT "PropostaMigracaoRegraTurma_origemId_fkey" FOREIGN KEY ("origemId") REFERENCES "VersaoRegraAvaliacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaMigracaoRegraTurma" ADD CONSTRAINT "PropostaMigracaoRegraTurma_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "VersaoRegraAvaliacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaMigracaoRegraTurma" ADD CONSTRAINT "PropostaMigracaoRegraTurma_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoMigracaoRegraTurma" ADD CONSTRAINT "DecisaoMigracaoRegraTurma_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaMigracaoRegraTurma"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoMigracaoRegraTurma" ADD CONSTRAINT "DecisaoMigracaoRegraTurma_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "PropostaMigracaoRegraTurma" ADD CONSTRAINT "migracao_regra_versao_positiva" CHECK (versao > 0);
CREATE FUNCTION conferir_turma_antes_avaliacao(turma_id TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE t "Turma"%ROWTYPE;
BEGIN
 SELECT * INTO t FROM "Turma" WHERE id = turma_id;
 IF t.status NOT IN ('PLANEJADA', 'ABERTA') OR
  EXISTS (SELECT 1 FROM "AulaDiario" WHERE "turmaId" = turma_id) OR
  EXISTS (SELECT 1 FROM "Evento" WHERE "agregadoTipo" = 'Turma' AND "agregadoId" = turma_id AND tipo = 'TurmaEmAndamento') OR
  EXISTS (SELECT 1 FROM "EncontroAgenda" WHERE "turmaId" = turma_id AND (status = 'MINISTRADO' OR (status = 'PREVISTO' AND inicio <= clock_timestamp()))) THEN
  RAISE EXCEPTION 'Turma já iniciou; regra de avaliação deve ser preservada';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM "EncontroAgenda" WHERE "turmaId" = turma_id AND status IN ('PREVISTO','MINISTRADO')) AND
  (t."dataInicio" IS NULL OR t."dataInicio" <= clock_timestamp()) THEN
  RAISE EXCEPTION 'Data futura ou agenda válida precisa ser conferida';
 END IF;
END;
$$;
CREATE FUNCTION preservar_migracao_regra_turma() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaMigracaoRegraTurma"%ROWTYPE; t "Turma"%ROWTYPE; autor TEXT; turma_id TEXT;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Migração de regra e decisão são imutáveis'; END IF;
 IF TG_TABLE_NAME = 'PropostaMigracaoRegraTurma' THEN
  p := NEW; autor := NEW."preparadorId";
 ELSE
  SELECT * INTO p FROM "PropostaMigracaoRegraTurma" WHERE id = NEW."propostaId";
  autor := NEW."decisorId";
  IF autor = p."preparadorId" THEN RAISE EXCEPTION 'Migração exige decisão independente'; END IF;
 END IF;
 turma_id := p."turmaId";
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
 SELECT * INTO t FROM "Turma" WHERE id = turma_id;
 PERFORM pg_advisory_xact_lock(hashtextextended('regra-avaliacao-nivel:' || t."nivelId", 0));
 PERFORM id FROM "Turma" WHERE id = turma_id FOR UPDATE;
 SELECT * INTO t FROM "Turma" WHERE id = turma_id;
 PERFORM id FROM "Usuario" WHERE id = autor AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Migração exige gestão ativa'; END IF;
 IF TG_TABLE_NAME = 'PropostaMigracaoRegraTurma' THEN
  IF p.versao <> (SELECT COALESCE(MAX(versao),0)+1 FROM "PropostaMigracaoRegraTurma" WHERE "turmaId" = turma_id) THEN RAISE EXCEPTION 'Versão da proposta desatualizada'; END IF;
 ELSIF NOT NEW.aprovada THEN
  RETURN NEW;
 ELSE
  IF p.versao <> (SELECT MAX(versao) FROM "PropostaMigracaoRegraTurma" WHERE "turmaId" = turma_id) THEN RAISE EXCEPTION 'Existe proposta mais recente'; END IF;
 END IF;
 PERFORM conferir_turma_antes_avaliacao(turma_id);
 IF t."regraAvaliacaoId" IS DISTINCT FROM p."origemId" THEN RAISE EXCEPTION 'Regra de origem mudou'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "VersaoRegraAvaliacao" v JOIN "DecisaoRegraAvaliacao" d ON d."regraId" = v.id AND d.aprovada
  WHERE v.id = p."destinoId" AND v."nivelId" = t."nivelId" AND
  (p."origemId" IS NULL OR v.versao > (SELECT versao FROM "VersaoRegraAvaliacao" WHERE id = p."origemId")) AND
  v.versao = (SELECT MAX(v2.versao) FROM "VersaoRegraAvaliacao" v2 JOIN "DecisaoRegraAvaliacao" d2 ON d2."regraId" = v2.id AND d2.aprovada WHERE v2."nivelId" = t."nivelId")) THEN
  RAISE EXCEPTION 'Destino precisa ser a publicação mais recente do mesmo nível';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_proposta_migracao_regra BEFORE INSERT OR UPDATE OR DELETE ON "PropostaMigracaoRegraTurma" FOR EACH ROW EXECUTE FUNCTION preservar_migracao_regra_turma();
CREATE TRIGGER preservar_decisao_migracao_regra BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoMigracaoRegraTurma" FOR EACH ROW EXECUTE FUNCTION preservar_migracao_regra_turma();
CREATE FUNCTION aplicar_migracao_regra_turma() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.aprovada THEN
  UPDATE "Turma" SET "regraAvaliacaoId" = p."destinoId" FROM "PropostaMigracaoRegraTurma" p WHERE p.id = NEW."propostaId" AND "Turma".id = p."turmaId";
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER aplicar_migracao_regra AFTER INSERT ON "DecisaoMigracaoRegraTurma" FOR EACH ROW EXECUTE FUNCTION aplicar_migracao_regra_turma();

CREATE OR REPLACE FUNCTION vincular_regra_inicial_turma() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  IF NEW."regraAvaliacaoId" IS NOT NULL THEN
   RAISE EXCEPTION 'Regra inicial é selecionada da publicação vigente, não informada livremente';
  END IF;
  -- Datas históricas, estado iniciado/concluído ou data desconhecida exigem conferência.
  IF NEW.status IN ('PLANEJADA', 'ABERTA') AND NEW."dataInicio" > CURRENT_TIMESTAMP THEN
   PERFORM pg_advisory_xact_lock(hashtextextended('regra-avaliacao-nivel:' || NEW."nivelId", 0));
   SELECT v.id INTO NEW."regraAvaliacaoId" FROM "VersaoRegraAvaliacao" v
    JOIN "DecisaoRegraAvaliacao" d ON d."regraId" = v.id AND d.aprovada
    WHERE v."nivelId" = NEW."nivelId" ORDER BY v.versao DESC LIMIT 1;
  END IF;
 ELSE
  IF NEW."regraAvaliacaoId" IS DISTINCT FROM OLD."regraAvaliacaoId" THEN
   IF (to_jsonb(NEW) - 'regraAvaliacaoId') IS DISTINCT FROM (to_jsonb(OLD) - 'regraAvaliacaoId') OR NOT EXISTS (
    SELECT 1 FROM "PropostaMigracaoRegraTurma" p JOIN "DecisaoMigracaoRegraTurma" d ON d."propostaId" = p.id AND d.aprovada
    WHERE p."turmaId" = OLD.id AND p."origemId" IS NOT DISTINCT FROM OLD."regraAvaliacaoId" AND p."destinoId" = NEW."regraAvaliacaoId"
   ) THEN RAISE EXCEPTION 'Mudança de regra da turma exige revisão e aprovação específica'; END IF;
   PERFORM conferir_turma_antes_avaliacao(OLD.id);
  END IF;
  IF OLD."regraAvaliacaoId" IS NOT NULL AND NEW."nivelId" <> OLD."nivelId" THEN
   RAISE EXCEPTION 'Nível com regra vinculada não pode mudar por edição direta';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
