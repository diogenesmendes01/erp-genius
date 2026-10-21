-- CreateTable
CREATE TABLE "ArtefatoContratual" (
    "id" TEXT NOT NULL,
    "previaId" TEXT NOT NULL,
    "conferenciaId" TEXT NOT NULL,
    "pdf" BYTEA NOT NULL,
    "pdfHash" TEXT NOT NULL,
    "baseHash" TEXT NOT NULL,
    "gerador" JSONB NOT NULL,
    "paginas" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autorId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,

    CONSTRAINT "ArtefatoContratual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArtefatoContratual_conferenciaId_key" ON "ArtefatoContratual"("conferenciaId");

-- CreateIndex
CREATE INDEX "ArtefatoContratual_previaId_criadoEm_idx" ON "ArtefatoContratual"("previaId", "criadoEm");

-- AddForeignKey
ALTER TABLE "ArtefatoContratual" ADD CONSTRAINT "ArtefatoContratual_previaId_fkey" FOREIGN KEY ("previaId") REFERENCES "PreviaDocumentoContratual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ArtefatoContratual" ADD CONSTRAINT "ArtefatoContratual_conferenciaId_fkey" FOREIGN KEY ("conferenciaId") REFERENCES "ConferenciaParticipantesContratuais"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ArtefatoContratual" ADD CONSTRAINT "ArtefatoContratual_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "ArtefatoContratual" ADD CONSTRAINT "artefato_pdf_limites" CHECK (octet_length(pdf) BETWEEN 5 AND 10485760 AND paginas > 0 AND "pdfHash" ~ '^[a-f0-9]{64}$' AND "baseHash" ~ '^[a-f0-9]{64}$');
CREATE FUNCTION preservar_artefato_contratual() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Artefato contratual é imutável'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "ConferenciaParticipantesContratuais" c WHERE c.id = NEW."conferenciaId" AND c."previaId" = NEW."previaId") THEN
  RAISE EXCEPTION 'Conferência não pertence à prévia';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_artefato_contratual BEFORE INSERT OR UPDATE OR DELETE ON "ArtefatoContratual" FOR EACH ROW EXECUTE FUNCTION preservar_artefato_contratual();
