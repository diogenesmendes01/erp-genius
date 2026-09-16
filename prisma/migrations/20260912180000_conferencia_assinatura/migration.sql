-- CreateTable
CREATE TABLE "ConferenciaAssinaturaContratual" (
    "id" TEXT NOT NULL,
    "artefatoId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "revisaoHash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConferenciaAssinaturaContratual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConferenciaAssinaturaContratual_artefatoId_criadaEm_idx" ON "ConferenciaAssinaturaContratual"("artefatoId", "criadaEm");

-- CreateIndex
CREATE UNIQUE INDEX "ConferenciaAssinaturaContratual_autorId_chaveIdempotencia_key" ON "ConferenciaAssinaturaContratual"("autorId", "chaveIdempotencia");

-- AddForeignKey
ALTER TABLE "ConferenciaAssinaturaContratual" ADD CONSTRAINT "ConferenciaAssinaturaContratual_artefatoId_fkey" FOREIGN KEY ("artefatoId") REFERENCES "ArtefatoContratual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ConferenciaAssinaturaContratual" ADD CONSTRAINT "ConferenciaAssinaturaContratual_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION preservar_conferencia_assinatura() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Conferência para assinatura é imutável';
END;
$$;
CREATE TRIGGER preservar_conferencia_assinatura BEFORE UPDATE OR DELETE ON "ConferenciaAssinaturaContratual" FOR EACH ROW EXECUTE FUNCTION preservar_conferencia_assinatura();
