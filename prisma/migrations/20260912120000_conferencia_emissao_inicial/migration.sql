-- CreateTable
CREATE TABLE "ConferenciaEmissaoInicial" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "emissaoId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "revisaoHash" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConferenciaEmissaoInicial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConferenciaEmissaoInicial_matriculaId_key" ON "ConferenciaEmissaoInicial"("matriculaId");

-- CreateIndex
CREATE UNIQUE INDEX "ConferenciaEmissaoInicial_emissaoId_key" ON "ConferenciaEmissaoInicial"("emissaoId");

-- CreateIndex
CREATE UNIQUE INDEX "ConferenciaEmissaoInicial_autorId_chaveIdempotencia_key" ON "ConferenciaEmissaoInicial"("autorId", "chaveIdempotencia");

-- AddForeignKey
ALTER TABLE "ConferenciaEmissaoInicial" ADD CONSTRAINT "ConferenciaEmissaoInicial_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ConferenciaEmissaoInicial" ADD CONSTRAINT "ConferenciaEmissaoInicial_emissaoId_fkey" FOREIGN KEY ("emissaoId") REFERENCES "EmissaoCobrancasEntrada"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ConferenciaEmissaoInicial" ADD CONSTRAINT "ConferenciaEmissaoInicial_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
CREATE FUNCTION preservar_conferencia_emissao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Conferência de emissão é imutável'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "EmissaoCobrancasEntrada" e WHERE e.id=NEW."emissaoId" AND e."matriculaId"=NEW."matriculaId" AND e.etapa='CONFERENCIA_SECRETARIA') THEN RAISE EXCEPTION 'Emissão incompatível com a conferência'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_conferencia_emissao BEFORE INSERT OR UPDATE OR DELETE ON "ConferenciaEmissaoInicial" FOR EACH ROW EXECUTE FUNCTION preservar_conferencia_emissao();
