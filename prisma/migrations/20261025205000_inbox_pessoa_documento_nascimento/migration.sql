ALTER TABLE "Pessoa"
  ADD COLUMN "documento" TEXT,
  ADD COLUMN "tipoDocumentoId" TEXT,
  ADD COLUMN "documentoPaisEmissor" TEXT,
  ADD COLUMN "nascimento" DATE;

CREATE INDEX "Pessoa_tipoDocumentoId_idx" ON "Pessoa"("tipoDocumentoId");

ALTER TABLE "Pessoa" ADD CONSTRAINT "Pessoa_tipoDocumentoId_fkey"
  FOREIGN KEY ("tipoDocumentoId") REFERENCES "TipoDocumento"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;