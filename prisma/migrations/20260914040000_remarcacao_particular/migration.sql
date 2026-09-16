-- CreateTable
CREATE TABLE "PropostaRemarcacaoParticular" (
    "id" TEXT NOT NULL,
    "encontroOriginalId" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "entrada" JSONB NOT NULL,
    "estado" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaRemarcacaoParticular_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoRemarcacaoParticular" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "encontroOriginalId" TEXT NOT NULL,
    "encontroNovoId" TEXT,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoRemarcacaoParticular_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropostaRemarcacaoParticular_encontroOriginalId_idx" ON "PropostaRemarcacaoParticular"("encontroOriginalId");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaRemarcacaoParticular_preparadorId_chaveIdempotencia_key" ON "PropostaRemarcacaoParticular"("preparadorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoRemarcacaoParticular_propostaId_key" ON "DecisaoRemarcacaoParticular"("propostaId");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoRemarcacaoParticular_encontroNovoId_key" ON "DecisaoRemarcacaoParticular"("encontroNovoId");

-- CreateIndex
CREATE INDEX "DecisaoRemarcacaoParticular_encontroOriginalId_idx" ON "DecisaoRemarcacaoParticular"("encontroOriginalId");

-- AddForeignKey
ALTER TABLE "PropostaRemarcacaoParticular" ADD CONSTRAINT "PropostaRemarcacaoParticular_encontroOriginalId_fkey" FOREIGN KEY ("encontroOriginalId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaRemarcacaoParticular" ADD CONSTRAINT "PropostaRemarcacaoParticular_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoRemarcacaoParticular" ADD CONSTRAINT "DecisaoRemarcacaoParticular_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaRemarcacaoParticular"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoRemarcacaoParticular" ADD CONSTRAINT "DecisaoRemarcacaoParticular_encontroOriginalId_fkey" FOREIGN KEY ("encontroOriginalId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoRemarcacaoParticular" ADD CONSTRAINT "DecisaoRemarcacaoParticular_encontroNovoId_fkey" FOREIGN KEY ("encontroNovoId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoRemarcacaoParticular" ADD CONSTRAINT "DecisaoRemarcacaoParticular_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE UNIQUE INDEX remarcacao_particular_aprovada_unica ON "DecisaoRemarcacaoParticular"("encontroOriginalId") WHERE aprovada;
ALTER TABLE "DecisaoRemarcacaoParticular" ADD CHECK (aprovada = ("encontroNovoId" IS NOT NULL) AND length(btrim(motivo)) >= 5);
CREATE TRIGGER preservar_proposta_remarcacao BEFORE UPDATE OR DELETE ON "PropostaRemarcacaoParticular" FOR EACH ROW EXECUTE FUNCTION preservar_cancelamento_particular();
CREATE TRIGGER preservar_decisao_remarcacao BEFORE UPDATE OR DELETE ON "DecisaoRemarcacaoParticular" FOR EACH ROW EXECUTE FUNCTION preservar_cancelamento_particular();
CREATE FUNCTION conferir_decisao_remarcacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaRemarcacaoParticular"; autorizado boolean; origem "EncontroAgenda"; novo "EncontroAgenda";
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
 SELECT * INTO p FROM "PropostaRemarcacaoParticular" WHERE id = NEW."propostaId" FOR SHARE;
 SELECT ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] INTO autorizado FROM "Usuario" WHERE id = NEW."decisorId" FOR SHARE;
 IF autorizado IS DISTINCT FROM true OR p."preparadorId" = NEW."decisorId" OR p."encontroOriginalId" IS DISTINCT FROM NEW."encontroOriginalId" THEN RAISE EXCEPTION 'Remarcação exige outra pessoa autorizada e origem correspondente'; END IF;
 IF NEW.aprovada THEN
  SELECT * INTO origem FROM "EncontroAgenda" WHERE id = NEW."encontroOriginalId" FOR SHARE;
  SELECT * INTO novo FROM "EncontroAgenda" WHERE id = NEW."encontroNovoId" FOR SHARE;
  IF origem.status <> 'CANCELADO' OR origem."matriculaId" IS NULL OR novo.status <> 'PREVISTO' OR novo."matriculaId" IS DISTINCT FROM origem."matriculaId" OR novo.fim - novo.inicio <> origem.fim - origem.inicio THEN RAISE EXCEPTION 'Remarcação incompatível com matrícula, duração ou estado'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_decisao_remarcacao BEFORE INSERT ON "DecisaoRemarcacaoParticular" FOR EACH ROW EXECUTE FUNCTION conferir_decisao_remarcacao();
