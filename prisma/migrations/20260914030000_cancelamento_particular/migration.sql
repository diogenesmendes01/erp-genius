-- CreateTable
CREATE TABLE "PropostaCancelamentoParticular" (
    "id" TEXT NOT NULL,
    "encontroId" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaCancelamentoParticular_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoCancelamentoParticular" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoCancelamentoParticular_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropostaCancelamentoParticular_encontroId_idx" ON "PropostaCancelamentoParticular"("encontroId");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaCancelamentoParticular_preparadorId_chaveIdempotenc_key" ON "PropostaCancelamentoParticular"("preparadorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoCancelamentoParticular_propostaId_key" ON "DecisaoCancelamentoParticular"("propostaId");

-- AddForeignKey
ALTER TABLE "PropostaCancelamentoParticular" ADD CONSTRAINT "PropostaCancelamentoParticular_encontroId_fkey" FOREIGN KEY ("encontroId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaCancelamentoParticular" ADD CONSTRAINT "PropostaCancelamentoParticular_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoCancelamentoParticular" ADD CONSTRAINT "DecisaoCancelamentoParticular_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaCancelamentoParticular"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoCancelamentoParticular" ADD CONSTRAINT "DecisaoCancelamentoParticular_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "PropostaCancelamentoParticular" ADD CHECK (length(btrim("motivo")) >= 5 AND "estado" ~ '^[a-f0-9]{64}$');
ALTER TABLE "DecisaoCancelamentoParticular" ADD CHECK (length(btrim("motivo")) >= 5);

CREATE FUNCTION preservar_cancelamento_particular() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Solicitação e decisão de cancelamento são preservadas';
END $$;
CREATE TRIGGER preservar_proposta_cancelamento BEFORE UPDATE OR DELETE ON "PropostaCancelamentoParticular"
FOR EACH ROW EXECUTE FUNCTION preservar_cancelamento_particular();
CREATE TRIGGER preservar_decisao_cancelamento BEFORE UPDATE OR DELETE ON "DecisaoCancelamentoParticular"
FOR EACH ROW EXECUTE FUNCTION preservar_cancelamento_particular();

CREATE FUNCTION conferir_decisor_cancelamento_particular() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE preparador text; autorizado boolean;
BEGIN
  SELECT "preparadorId" INTO preparador FROM "PropostaCancelamentoParticular" WHERE id = NEW."propostaId" FOR SHARE;
  SELECT ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] INTO autorizado
    FROM "Usuario" WHERE id = NEW."decisorId" FOR SHARE;
  IF preparador = NEW."decisorId" OR autorizado IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Cancelamento exige outra pessoa autorizada';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER conferir_decisor_cancelamento BEFORE INSERT ON "DecisaoCancelamentoParticular"
FOR EACH ROW EXECUTE FUNCTION conferir_decisor_cancelamento_particular();
