-- CreateTable
CREATE TABLE "RascunhoReplanejamento" (
    "id" TEXT NOT NULL,
    "calendarioId" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "estadoHash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RascunhoReplanejamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RascunhoReplanejamento_calendarioId_versao_key" ON "RascunhoReplanejamento"("calendarioId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "RascunhoReplanejamento_preparadorId_chaveIdempotencia_key" ON "RascunhoReplanejamento"("preparadorId", "chaveIdempotencia");

-- AddForeignKey
ALTER TABLE "RascunhoReplanejamento" ADD CONSTRAINT "RascunhoReplanejamento_calendarioId_fkey" FOREIGN KEY ("calendarioId") REFERENCES "VersaoCalendarioEscolar"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RascunhoReplanejamento" ADD CONSTRAINT "RascunhoReplanejamento_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;


CREATE FUNCTION preservar_rascunho_replanejamento() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Rascunho de replanejamento deve permanecer preservado'; END $$;
CREATE TRIGGER rascunho_replanejamento_preservado BEFORE UPDATE OR DELETE ON "RascunhoReplanejamento" FOR EACH ROW EXECUTE FUNCTION preservar_rascunho_replanejamento();
