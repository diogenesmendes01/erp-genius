-- CreateTable
CREATE TABLE "ConferenciaParticipantesContratuais" (
    "id" TEXT NOT NULL,
    "previaId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "autorId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConferenciaParticipantesContratuais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConferenciaParticipantesContratuais_previaId_versao_key" ON "ConferenciaParticipantesContratuais"("previaId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "ConferenciaParticipantesContratuais_autorId_chaveIdempotenc_key" ON "ConferenciaParticipantesContratuais"("autorId", "chaveIdempotencia");

-- AddForeignKey
ALTER TABLE "ConferenciaParticipantesContratuais" ADD CONSTRAINT "ConferenciaParticipantesContratuais_previaId_fkey" FOREIGN KEY ("previaId") REFERENCES "PreviaDocumentoContratual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ConferenciaParticipantesContratuais" ADD CONSTRAINT "ConferenciaParticipantesContratuais_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "ConferenciaParticipantesContratuais" ADD CONSTRAINT "participantes_versao_positiva" CHECK (versao > 0);
CREATE FUNCTION preservar_conferencia_participantes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Conferência de participantes é imutável';
END;
$$;
CREATE TRIGGER preservar_conferencia_participantes BEFORE UPDATE OR DELETE ON "ConferenciaParticipantesContratuais" FOR EACH ROW EXECUTE FUNCTION preservar_conferencia_participantes();
