-- CreateTable
CREATE TABLE "PreviaDocumentoContratual" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "modeloId" TEXT NOT NULL,
    "condicoesId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "conteudoHash" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreviaDocumentoContratual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PreviaDocumentoContratual_matriculaId_criadaEm_idx" ON "PreviaDocumentoContratual"("matriculaId", "criadaEm");

-- CreateIndex
CREATE UNIQUE INDEX "PreviaDocumentoContratual_autorId_chaveIdempotencia_key" ON "PreviaDocumentoContratual"("autorId", "chaveIdempotencia");

-- AddForeignKey
ALTER TABLE "PreviaDocumentoContratual" ADD CONSTRAINT "PreviaDocumentoContratual_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PreviaDocumentoContratual" ADD CONSTRAINT "PreviaDocumentoContratual_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "VersaoModeloContratual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PreviaDocumentoContratual" ADD CONSTRAINT "PreviaDocumentoContratual_condicoesId_fkey" FOREIGN KEY ("condicoesId") REFERENCES "CondicoesEntradaPreparacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PreviaDocumentoContratual" ADD CONSTRAINT "PreviaDocumentoContratual_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION preservar_previa_contratual() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Prévia contratual é imutável'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "CondicoesEntradaPreparacao" WHERE id=NEW."condicoesId" AND "matriculaId"=NEW."matriculaId") THEN RAISE EXCEPTION 'Condições de outra matrícula'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "DecisaoModeloContratual" WHERE "modeloId"=NEW."modeloId" AND aprovada) THEN RAISE EXCEPTION 'Modelo não publicado'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_previa_contratual BEFORE INSERT OR UPDATE OR DELETE ON "PreviaDocumentoContratual" FOR EACH ROW EXECUTE FUNCTION preservar_previa_contratual();
